from rest_framework import serializers
from .models import Medicamento, Fornecedor
from .models import Movimentacao

class FornecedorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Fornecedor
        fields = ["id", "nome", "cnpj", "telefone", "email"]


class MedicamentoSerializer(serializers.ModelSerializer):
    fornecedor_nome = serializers.CharField(source="fornecedor.nome", read_only=True)

    class Meta:
        model = Medicamento
        fields = [
            "id",
            "nome",
            "miligrama",
            "categoria",
            "lote",
            "validade",
            "quantidade",
            "estoque_min",
            "valor_unit",
            "fornecedor",        # <- envia/recebe o ID
            "fornecedor_nome",   # <- devolve o nome pronto pro frontend
            "data_cadastro",
            "data_atualizacao",
        ]

class MovimentacaoSerializer(serializers.ModelSerializer):
    medicamento_nome = serializers.CharField(source="medicamento.nome", read_only=True)

    class Meta:
        model = Movimentacao
        fields = [
            "id",
            "medicamento",
            "medicamento_nome",
            "tipo",
            "quantidade",
            "data_movimentacao",
            "observacao",
        ]

