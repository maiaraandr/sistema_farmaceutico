from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    MedicamentoViewSet,
    FornecedorViewSet,
    MovimentacaoViewSet,
    solicitar_recuperacao_senha,
    redefinir_senha,
)

router = DefaultRouter()
router.register(r"medicamentos", MedicamentoViewSet, basename="medicamentos")
router.register(r"fornecedores", FornecedorViewSet, basename="fornecedores")
router.register(r"movimentacoes", MovimentacaoViewSet, basename="movimentacoes")

urlpatterns = [
    path("", include(router.urls)),
    path("recuperar-senha/", solicitar_recuperacao_senha, name="recuperar_senha"),
    path("redefinir-senha/", redefinir_senha, name="redefinir_senha"),
]