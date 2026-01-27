from django.db import models

class Medicamento(models.Model):
    nome = models.CharField(max_length=100)
    laboratorio = models.CharField(max_length=100)
    lote = models.CharField(max_length=50)
    validade = models.DateField()
    quantidade = models.PositiveIntegerField()
    preco = models.DecimalField(max_digits=10, decimal_places=2)
    data_cadastro = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.nome} - Lote {self.lote}"
