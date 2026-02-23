from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MedicamentoViewSet, FornecedorViewSet, MovimentacaoViewSet

router = DefaultRouter()
router.register(r"medicamentos", MedicamentoViewSet, basename="medicamentos")
router.register(r"fornecedores", FornecedorViewSet, basename="fornecedores")
router.register(r"movimentacoes", MovimentacaoViewSet, basename="movimentacoes")

urlpatterns = [
    path("", include(router.urls)),
]

