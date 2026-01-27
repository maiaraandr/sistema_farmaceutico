from django.contrib import admin
from .models import Medicamento

@admin.register(Medicamento)
class MedicamentoAdmin(admin.ModelAdmin):
    list_display = (
        'nome',
        'laboratorio',
        'lote',
        'validade',
        'quantidade',
        'preco',
        'data_cadastro',
    )
    search_fields = ('nome', 'laboratorio', 'lote')
    list_filter = ('laboratorio', 'validade')
