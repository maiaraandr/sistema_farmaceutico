import os

import requests as http_requests

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.db import transaction
from django.db.models import Sum
from django.utils.dateparse import parse_date
from django.utils.encoding import force_bytes, force_str
from django.utils.http import (
    urlsafe_base64_decode,
    urlsafe_base64_encode,
)

from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Fornecedor, Medicamento, Movimentacao
from .serializers import (
    FornecedorSerializer,
    MedicamentoSerializer,
    MovimentacaoSerializer,
)

User = get_user_model()


class FornecedorViewSet(viewsets.ModelViewSet):
    queryset = Fornecedor.objects.all().order_by("nome")
    serializer_class = FornecedorSerializer


class MedicamentoViewSet(viewsets.ModelViewSet):
    queryset = Medicamento.objects.select_related("fornecedor").all()
    serializer_class = MedicamentoSerializer


class MovimentacaoViewSet(viewsets.ModelViewSet):
    queryset = Movimentacao.objects.select_related("medicamento").all()
    serializer_class = MovimentacaoSerializer

    @action(detail=False, methods=["get"], url_path="relatorio-geral")
    def relatorio_geral(self, request):
        qs = self.get_queryset()

        data_inicio_str = request.query_params.get("data_inicio")
        data_fim_str = request.query_params.get("data_fim")

        data_inicio = parse_date(data_inicio_str) if data_inicio_str else None
        data_fim = parse_date(data_fim_str) if data_fim_str else None

        if data_inicio_str and not data_inicio:
            return Response(
                {"erro": "data_inicio inválida. Use YYYY-MM-DD."},
                status=400,
            )

        if data_fim_str and not data_fim:
            return Response(
                {"erro": "data_fim inválida. Use YYYY-MM-DD."},
                status=400,
            )

        if data_inicio and data_fim and data_inicio > data_fim:
            return Response(
                {"erro": "data_inicio não pode ser maior que data_fim."},
                status=400,
            )

        if data_inicio:
            qs = qs.filter(data_movimentacao__date__gte=data_inicio)

        if data_fim:
            qs = qs.filter(data_movimentacao__date__lte=data_fim)

        total_entradas = (
            qs.filter(tipo="E").aggregate(total=Sum("quantidade"))["total"] or 0
        )

        total_saidas = (
            qs.filter(tipo="S").aggregate(total=Sum("quantidade"))["total"] or 0
        )

        saldo_geral = total_entradas - total_saidas

        top_saidas = (
            qs.filter(tipo="S")
            .values(
                "medicamento__id",
                "medicamento__nome",
                "medicamento__miligrama",
            )
            .annotate(total=Sum("quantidade"))
            .order_by("-total")[:10]
        )

        top_saidas_formatado = [
            {
                "medicamento_id": item["medicamento__id"],
                "medicamento": (
                    f'{item["medicamento__nome"]} '
                    f'{item["medicamento__miligrama"]}'
                ).strip(),
                "total": item["total"],
            }
            for item in top_saidas
        ]

        return Response(
            {
                "filtros": {
                    "data_inicio": data_inicio_str,
                    "data_fim": data_fim_str,
                },
                "total_entradas": total_entradas,
                "total_saidas": total_saidas,
                "saldo_geral": saldo_geral,
                "top_medicamentos_saida": top_saidas_formatado,
            }
        )

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        medicamento = serializer.validated_data["medicamento"]
        tipo = serializer.validated_data["tipo"]
        quantidade = serializer.validated_data["quantidade"]

        medicamento = Medicamento.objects.select_for_update().get(
            id=medicamento.id
        )

        if tipo == "E":
            medicamento.quantidade += quantidade

        elif tipo == "S":
            if medicamento.quantidade < quantidade:
                return Response(
                    {"erro": "Estoque insuficiente para esta saída."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            medicamento.quantidade -= quantidade

        medicamento.save()

        self.perform_create(serializer)

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
        )


@api_view(["POST"])
@transaction.atomic
def registrar_entrada(request):
    nome = (request.data.get("nome") or "").strip()
    miligrama = (request.data.get("miligrama") or "").strip() or None
    categoria = (request.data.get("categoria") or "").strip()
    lote = (request.data.get("lote") or "").strip()
    validade = request.data.get("validade")
    quantidade = request.data.get("quantidade")
    valor_unit = request.data.get("valor_unit")
    fornecedor_id = request.data.get("fornecedor")
    descricao = request.data.get("descricao") or ""
    data_entrada = request.data.get("data_entrada") or ""

    if not nome:
        return Response(
            {"erro": "Nome do medicamento é obrigatório."},
            status=400,
        )

    if not categoria:
        return Response(
            {"erro": "Categoria é obrigatória."},
            status=400,
        )

    if not lote:
        return Response(
            {"erro": "Lote é obrigatório."},
            status=400,
        )

    if not validade:
        return Response(
            {"erro": "Validade é obrigatória."},
            status=400,
        )

    try:
        quantidade = int(quantidade)

    except (TypeError, ValueError):
        return Response(
            {"erro": "Quantidade inválida."},
            status=400,
        )

    if quantidade <= 0:
        return Response(
            {"erro": "Quantidade deve ser maior que zero."},
            status=400,
        )

    try:
        valor_unit = float(valor_unit)

    except (TypeError, ValueError):
        return Response(
            {"erro": "Valor unitário inválido."},
            status=400,
        )

    if valor_unit < 0:
        return Response(
            {"erro": "Valor unitário não pode ser negativo."},
            status=400,
        )

    try:
        fornecedor = Fornecedor.objects.get(id=fornecedor_id)

    except Fornecedor.DoesNotExist:
        return Response(
            {"erro": "Fornecedor não encontrado."},
            status=400,
        )

    medicamento = (
        Medicamento.objects.select_for_update()
        .filter(
            nome__iexact=nome,
            miligrama=miligrama,
            categoria__iexact=categoria,
            lote__iexact=lote,
            validade=validade,
            valor_unit=valor_unit,
            fornecedor=fornecedor,
        )
        .first()
    )

    criado = False

    if medicamento:
        medicamento.quantidade += quantidade
        medicamento.descricao = descricao
        medicamento.save()

    else:
        medicamento = Medicamento.objects.create(
            nome=nome,
            miligrama=miligrama,
            categoria=categoria,
            lote=lote,
            validade=validade,
            quantidade=quantidade,
            valor_unit=valor_unit,
            descricao=descricao,
            fornecedor=fornecedor,
        )

        criado = True

    observacao = " | ".join(
        [
            f"Fornecedor: {fornecedor.nome}",
            f"Categoria: {categoria}",
            f"Lote: {lote}",
            f"Validade informada: {validade}",
            f"Valor unitário: {valor_unit}",
            f"Data da entrada: {data_entrada}",
        ]
    )

    movimentacao = Movimentacao.objects.create(
        medicamento=medicamento,
        tipo=Movimentacao.TIPO_ENTRADA,
        quantidade=quantidade,
        observacao=observacao,
    )

    return Response(
        {
            "sucesso": True,
            "criado": criado,
            "medicamento": MedicamentoSerializer(medicamento).data,
            "movimentacao": MovimentacaoSerializer(movimentacao).data,
        },
        status=status.HTTP_201_CREATED,
    )


# ── Autenticação ──────────────────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([AllowAny])
def cadastrar_usuario(request):
    # Verifica se o admin_id enviado pelo frontend pertence a um usuário is_staff
    admin_id = request.data.get("admin_id")
    if not admin_id:
        return Response(
            {"erro": "Apenas administradores podem cadastrar novos usuários."},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        admin_user = User.objects.get(id=admin_id)
        if not admin_user.is_staff:
            return Response(
                {"erro": "Apenas administradores podem cadastrar novos usuários."},
                status=status.HTTP_403_FORBIDDEN,
            )
    except User.DoesNotExist:
        return Response(
            {"erro": "Apenas administradores podem cadastrar novos usuários."},
            status=status.HTTP_403_FORBIDDEN,
        )

    nome = (request.data.get("nome") or "").strip()
    email = (request.data.get("email") or "").strip().lower()
    usuario = (request.data.get("usuario") or "").strip()
    senha = request.data.get("senha") or ""
    telefone = (request.data.get("telefone") or "").strip()

    if not nome:
        return Response(
            {"erro": "Nome é obrigatório."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not email:
        return Response(
            {"erro": "E-mail é obrigatório."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not usuario or len(usuario) < 4:
        return Response(
            {"erro": "Usuário deve ter no mínimo 4 caracteres."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not senha or len(senha) < 6:
        return Response(
            {"erro": "Senha deve ter no mínimo 6 caracteres."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if User.objects.filter(username__iexact=usuario).exists():
        return Response(
            {"erro": "Este usuário já existe."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if User.objects.filter(email__iexact=email).exists():
        return Response(
            {"erro": "Este e-mail já está cadastrado."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    partes = nome.split(" ", 1)
    first_name = partes[0]
    last_name = partes[1] if len(partes) > 1 else ""

    user = User.objects.create_user(
        username=usuario,
        email=email,
        password=senha,
        first_name=first_name,
        last_name=last_name,
    )

    return Response(
        {
            "sucesso": True,
            "mensagem": "Conta criada com sucesso.",
            "usuario": {
                "id": user.id,
                "usuario": user.username,
                "nome": user.get_full_name() or user.username,
                "email": user.email,
                "telefone": telefone,
            },
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def login_usuario(request):
    login = (
        request.data.get("usuario")
        or request.data.get("login")
        or ""
    ).strip()

    senha = request.data.get("senha") or ""

    if not login or not senha:
        return Response(
            {"erro": "Usuário e senha são obrigatórios."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = authenticate(
        request,
        username=login,
        password=senha,
    )

    if not user:
        try:
            u = User.objects.filter(email__iexact=login).first()

            if u:
                user = authenticate(
                    request,
                    username=u.username,
                    password=senha,
                )

        except Exception:
            pass

    if not user:
        return Response(
            {"erro": "Usuário ou senha inválidos."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user.is_active:
        return Response(
            {"erro": "Conta desativada."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    return Response(
        {
            "sucesso": True,
            "mensagem": "Login realizado com sucesso.",
            "usuario": {
                "id": user.id,
                "usuario": user.username,
                "nome": user.get_full_name() or user.username,
                "email": user.email,
                "is_admin": user.is_staff,  # <── campo novo: identifica admin
            },
        }
    )


# ── Recuperação de senha ──────────────────────────────────────────────────────

def _html_email_recuperacao(nome_usuario, reset_link):
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
</head>

<body style="margin:0;padding:0;background:#f0f4ff;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0"
       style="background:#f0f4ff;padding:40px 20px;">

<tr>
<td align="center">

<table width="560" cellpadding="0" cellspacing="0"
       style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 30px rgba(37,99,235,.12);">

<tr>
<td style="background:linear-gradient(90deg,#4f7df2,#3e72f0);padding:36px 40px;text-align:center;">
<p style="margin:0 0 6px;font-size:12px;font-weight:700;color:rgba(255,255,255,.75);text-transform:uppercase;letter-spacing:.1em;">
GestMed
</p>

<h1 style="margin:0;font-size:26px;font-weight:800;color:#fff;">
Recuperação de Senha
</h1>
</td>
</tr>

<tr>
<td style="padding:40px;">

<p style="margin:0 0 16px;font-size:15px;color:#334155;">
Olá, <strong>{nome_usuario}</strong>!
</p>

<p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
Recebemos uma solicitação para redefinir a senha da sua conta no
<strong>GestMed</strong>.
</p>

<p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.6;">
Clique no botão abaixo para criar uma nova senha.
Este link é válido por <strong>1 hora</strong>.
</p>

<table cellpadding="0" cellspacing="0" width="100%">
<tr>
<td align="center">

<a href="{reset_link}"
   style="display:inline-block;background:linear-gradient(90deg,#4f7df2,#3e72f0);color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:12px;box-shadow:0 4px 14px rgba(37,99,235,.3);">
Redefinir minha senha
</a>

</td>
</tr>
</table>

<p style="margin:28px 0 0;font-size:13px;color:#94a3b8;text-align:center;line-height:1.6;">
Se o botão não funcionar, copie e cole o link abaixo no navegador:
</p>

<p style="margin:8px 0 0;font-size:12px;color:#64748b;text-align:center;word-break:break-all;">
<a href="{reset_link}" style="color:#3e72f0;">
{reset_link}
</a>
</p>

<hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;"/>

<p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
Se você não solicitou a recuperação de senha, ignore este e-mail.
</p>

</td>
</tr>

<tr>
<td style="background:#f8faff;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">

<p style="margin:0;font-size:12px;color:#94a3b8;">
© GestMed — Sistema de Gestão Farmacêutica
</p>

</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
"""


@api_view(["POST"])
@permission_classes([AllowAny])
def solicitar_recuperacao_senha(request):
    email = (request.data.get("email") or "").strip().lower()

    if not email:
        return Response(
            {"erro": "Email é obrigatório."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    resposta_padrao = Response(
        {
            "sucesso": True,
            "mensagem": (
                "Se o email existir, o link de recuperação será enviado."
            ),
        },
        status=status.HTTP_200_OK,
    )

    user = User.objects.filter(email__iexact=email).first()

    if not user:
        return resposta_padrao

    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)

    site_url = getattr(
        settings,
        "SITE_URL",
        "http://127.0.0.1:5500/Frontend",
    )

    reset_link = (
        f"{site_url}/html/reset-password.html"
        f"?uid={uid}&token={token}"
    )

    nome_usuario = user.get_full_name() or user.username

    payload = {
        "sender": {"name": "GestMed", "email": "maysilva29andrade@gmail.com"},
        "to": [{"email": user.email}],
        "subject": "GestMed — Recuperação de senha",
        "htmlContent": _html_email_recuperacao(nome_usuario, reset_link),
    }

    try:
        resp = http_requests.post(
            "https://api.brevo.com/v3/smtp/email",
            json=payload,
            headers={
                "api-key": os.getenv("BREVO_API_KEY"),
                "Content-Type": "application/json",
            },
            timeout=10,
        )

        if resp.status_code not in (200, 201):
            return Response(
                {"sucesso": False, "erro": resp.text},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    except Exception as e:
        return Response(
            {"sucesso": False, "erro": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return resposta_padrao


@api_view(["POST"])
@permission_classes([AllowAny])
def redefinir_senha(request):
    uid = request.data.get("uid")
    token = request.data.get("token")
    nova_senha = request.data.get("nova_senha")

    if not uid or not token or not nova_senha:
        return Response(
            {"erro": "Dados incompletos."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if len(nova_senha) < 6:
        return Response(
            {"erro": "A senha deve ter pelo menos 6 caracteres."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id)

    except Exception:
        return Response(
            {"erro": "Link inválido."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not default_token_generator.check_token(user, token):
        return Response(
            {"erro": "Token inválido ou expirado."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user.set_password(nova_senha)
    user.save()

    return Response(
        {
            "sucesso": True,
            "mensagem": "Senha redefinida com sucesso.",
        }
    )