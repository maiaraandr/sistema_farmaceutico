# farmacia/views.py

from django.db import transaction
from django.db.models import Sum
from django.utils.dateparse import parse_date
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Fornecedor, Medicamento, Movimentacao
from .serializers import (
    FornecedorSerializer,
    MedicamentoSerializer,
    MovimentacaoSerializer,
)


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
        total_saidas = qs.filter(tipo="S").aggregate(total=Sum("quantidade"))["total"] or 0
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