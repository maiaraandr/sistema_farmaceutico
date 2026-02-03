from django.shortcuts import render

from rest_framework.viewsets import ModelViewSet
from .models import Medicamento
from .serializers import MedicamentoSerializer


class MedicamentoViewSet(ModelViewSet):
    queryset = Medicamento.objects.all().order_by("-id")
    serializer_class = MedicamentoSerializer

