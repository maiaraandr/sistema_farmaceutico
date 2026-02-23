from django.contrib import admin
from .models import Medicamento, Fornecedor

@admin.register(Fornecedor)
class FornecedorAdmin(admin.ModelAdmin):
    list_display = ("id", "nome", "cnpj", "telefone", "email", "data_cadastro")
    search_fields = ("nome", "cnpj", "email")


@admin.register(Medicamento)
class MedicamentoAdmin(admin.ModelAdmin):
    list_display = ("id", "nome", "miligrama", "lote", "validade", "quantidade", "fornecedor")
    list_filter = ("categoria", "validade")
    search_fields = ("nome", "miligrama", "lote", "fornecedor__nome")