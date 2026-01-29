from django.contrib import admin
from .models import Medicamento

# remove registro anterior, caso exista
try:
    admin.site.unregister(Medicamento)
except admin.sites.NotRegistered:
    pass

@admin.register(Medicamento)
class MedicamentoAdmin(admin.ModelAdmin):
    list_display = ("nome", "lote", "validade", "quantidade", "fornecedor", "data_cadastro")
    search_fields = ("nome", "lote", "fornecedor")
    list_filter = ("fornecedor", "validade")
