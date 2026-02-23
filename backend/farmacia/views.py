from rest_framework import viewsets
from .models import Medicamento, Fornecedor
from .serializers import MedicamentoSerializer, FornecedorSerializer
from .models import Movimentacao
from .serializers import MovimentacaoSerializer
from django.db import transaction
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework import status


class FornecedorViewSet(viewsets.ModelViewSet):
    queryset = Fornecedor.objects.all().order_by("nome")
    serializer_class = FornecedorSerializer


class MedicamentoViewSet(viewsets.ModelViewSet):
    queryset = Medicamento.objects.select_related("fornecedor").all()
    serializer_class = MedicamentoSerializer


class MovimentacaoViewSet(viewsets.ModelViewSet):
    queryset = Movimentacao.objects.select_related("medicamento").all()
    serializer_class = MovimentacaoSerializer


class MovimentacaoViewSet(viewsets.ModelViewSet):
    queryset = Movimentacao.objects.select_related("medicamento").all()
    serializer_class = MovimentacaoSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        medicamento = serializer.validated_data["medicamento"]
        tipo = serializer.validated_data["tipo"]
        quantidade = serializer.validated_data["quantidade"]

        # 🔒 trava o registro do medicamento (evita concorrência)
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