from django.db import models
from django.db.models import Q
from django.db import models   
from django.db import models
from django.db.models import Q


class Fornecedor(models.Model):
    nome = models.CharField(max_length=120, verbose_name="Nome do fornecedor", unique=True)
    cnpj = models.CharField(max_length=18, verbose_name="CNPJ", blank=True, null=True)
    telefone = models.CharField(max_length=20, verbose_name="Telefone", blank=True, null=True)
    email = models.EmailField(verbose_name="E-mail", blank=True, null=True)
    endereco = models.CharField(max_length=255, verbose_name="Endereço", blank=True, null=True)
    ativo = models.BooleanField(default=True, verbose_name="Ativo")

    data_cadastro = models.DateTimeField(auto_now_add=True, verbose_name="Data de cadastro")
    data_atualizacao = models.DateTimeField(auto_now=True, verbose_name="Última atualização")

    class Meta:
        verbose_name = "Fornecedor"
        verbose_name_plural = "Fornecedores"
        ordering = ["nome"]
        indexes = [
            models.Index(fields=["nome"], name="idx_forn_nome"),
        ]

    def __str__(self):
        return self.nome

class Medicamento(models.Model):
    nome = models.CharField(max_length=120, verbose_name="Nome do medicamento")

    # Como você já tem registros antigos no banco, deixe opcionais por enquanto
    miligrama = models.CharField(
        max_length=30,
        verbose_name="Dosagem (mg/ml)",
        blank=True,
        null=True
    )

    categoria = models.CharField(
        max_length=60,
        verbose_name="Categoria",
        blank=True,
        null=True
    )

    lote = models.CharField(max_length=50, verbose_name="Lote")
    validade = models.DateField(verbose_name="Data de validade")

    quantidade = models.PositiveIntegerField(verbose_name="Quantidade em estoque", default=0)
    estoque_min = models.PositiveIntegerField(verbose_name="Estoque mínimo", default=0)

    valor_unit = models.DecimalField(
        verbose_name="Valor unitário",
        max_digits=10,
        decimal_places=2,
        default=0
    )

    fornecedor = models.ForeignKey(
    "Fornecedor",
    on_delete=models.PROTECT,
    related_name="medicamentos",
    verbose_name="Fornecedor"
)

    data_cadastro = models.DateTimeField(auto_now_add=True, verbose_name="Data de cadastro")
    data_atualizacao = models.DateTimeField(auto_now=True, verbose_name="Última atualização")

    class Meta:
        verbose_name = "Medicamento"
        verbose_name_plural = "Medicamentos"
        ordering = ["nome"]

        indexes = [
            models.Index(fields=["nome"], name="idx_medic_nome"),
            models.Index(fields=["categoria"], name="idx_medic_categoria"),
            models.Index(fields=["validade"], name="idx_medic_validade"),
        ]

        constraints = [
            # Evita duplicar o mesmo medicamento no mesmo lote (quando miligrama estiver preenchido)
            models.UniqueConstraint(
                fields=["nome", "lote", "miligrama"],
                name="uq_medic_nome_lote_mg",
                condition=Q(miligrama__isnull=False),
            ),

            # ✅ Django 6: usa "condition=" (não "check=")
            models.CheckConstraint(
                condition=Q(quantidade__gte=0) & Q(estoque_min__gte=0) & Q(valor_unit__gte=0),
                name="ck_medic_valores_nao_negativos",
            ),
        ]

    def __str__(self):
        mg = f" {self.miligrama}" if self.miligrama else ""
        return f"{self.nome}{mg} | Lote: {self.lote}"
    

class Movimentacao(models.Model):
    TIPO_ENTRADA = "E"
    TIPO_SAIDA = "S"
    TIPOS = [
        (TIPO_ENTRADA, "Entrada"),
        (TIPO_SAIDA, "Saída"),
    ]

    medicamento = models.ForeignKey(
        "Medicamento",
        on_delete=models.PROTECT,
        related_name="movimentacoes",
        verbose_name="Medicamento",
    )

    tipo = models.CharField(max_length=1, choices=TIPOS, verbose_name="Tipo")
    quantidade = models.PositiveIntegerField(verbose_name="Quantidade")
    data_movimentacao = models.DateTimeField(auto_now_add=True, verbose_name="Data/Hora")

    observacao = models.CharField(max_length=255, blank=True, null=True, verbose_name="Observação")

    class Meta:
        verbose_name = "Movimentação"
        verbose_name_plural = "Movimentações"
        ordering = ["-data_movimentacao"]
        indexes = [
            models.Index(fields=["tipo"], name="idx_mov_tipo"),
            models.Index(fields=["data_movimentacao"], name="idx_mov_data"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(quantidade__gt=0),
                name="ck_mov_qtd_maior_que_zero",
            ),
        ]

    def __str__(self):
        return f"{self.get_tipo_display()} - {self.medicamento} - {self.quantidade}"