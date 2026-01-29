from django.db import models


class Medicamento(models.Model):
    nome = models.CharField(
        max_length=100,
        verbose_name="Nome do medicamento"
    )

    lote = models.CharField(
        max_length=50,
        verbose_name="Lote"
    )

    validade = models.DateField(
        verbose_name="Data de validade"
    )

    quantidade = models.PositiveIntegerField(
        verbose_name="Quantidade em estoque"
    )

    fornecedor = models.CharField(
        max_length=100,
        verbose_name="Fornecedor"
    )

    data_cadastro = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Data de cadastro"
    )

    class Meta:
        verbose_name = "Medicamento"
        verbose_name_plural = "Medicamentos"
        ordering = ["nome"]

    def __str__(self):
        return f"{self.nome} | Lote: {self.lote}"
