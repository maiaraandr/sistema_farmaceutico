# farmacia/views.py

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Sum
from django.utils.dateparse import parse_date
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

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

        # filtros: ?data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD
        data_inicio_str = request.query_params.get("data_inicio")
        data_fim_str = request.query_params.get("data_fim")

        data_inicio = parse_date(data_inicio_str) if data_inicio_str else None
        data_fim = parse_date(data_fim_str) if data_fim_str else None

        if data_inicio_str and not data_inicio:
            return Response(
                {"erro": "data_inicio inválida. Use YYYY-MM-DD (ex: 2026-02-01)."},
                status=400,
            )
        if data_fim_str and not data_fim:
            return Response(
                {"erro": "data_fim inválida. Use YYYY-MM-DD (ex: 2026-02-28)."},
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
            .values("medicamento__id", "medicamento__nome", "medicamento__miligrama")
            .annotate(total=Sum("quantidade"))
            .order_by("-total")[:10]
        )

        top_saidas_formatado = [
            {
                "medicamento_id": item["medicamento__id"],
                "medicamento": f'{item["medicamento__nome"]} {item["medicamento__miligrama"]}'.strip(),
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

        # trava o registro do medicamento (evita concorrência)
        medicamento = Medicamento.objects.select_for_update().get(id=medicamento.id)

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
        return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
def solicitar_recuperacao_senha(request):
    email = (request.data.get("email") or "").strip().lower()

    if not email:
      return Response(
          {"erro": "Email é obrigatório."},
          status=status.HTTP_400_BAD_REQUEST,
      )

    try:
        user = User.objects.get(email__iexact=email)
    except User.DoesNotExist:
        # resposta neutra por segurança
        return Response(
            {
                "sucesso": True,
                "mensagem": "Se o email existir, o link de recuperação será enviado."
            },
            status=status.HTTP_200_OK,
        )

    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)

    site_url = getattr(settings, "SITE_URL", "http://127.0.0.1:5500")
    reset_link = f"{site_url}/resetar-senha.html?uid={uid}&token={token}"

    assunto = "Recuperação de senha - GestMed"
    mensagem = (
        f"Olá, {getattr(user, 'username', 'usuário')}.\n\n"
        "Recebemos uma solicitação para redefinir sua senha.\n\n"
        f"Acesse o link abaixo para criar uma nova senha:\n{reset_link}\n\n"
        "Se você não solicitou esta alteração, ignore este email."
    )

    send_mail(
        assunto,
        mensagem,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=False,
    )

    return Response(
        {
            "sucesso": True,
            "mensagem": "Se o email existir, o link de recuperação será enviado."
        },
        status=status.HTTP_200_OK,
    )


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
        {"sucesso": True, "mensagem": "Senha redefinida com sucesso."},
        status=status.HTTP_200_OK,
    )