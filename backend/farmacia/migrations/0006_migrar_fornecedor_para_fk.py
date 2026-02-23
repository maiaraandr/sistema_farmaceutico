from django.db import migrations


def forwards(apps, schema_editor):
    Medicamento = apps.get_model("farmacia", "Medicamento")
    Fornecedor = apps.get_model("farmacia", "Fornecedor")

    for med in Medicamento.objects.all().iterator():
        nome = (getattr(med, "fornecedor", "") or "").strip()
        if not nome:
            # Se estiver vazio, deixa NULL por enquanto
            continue

        fornecedor_obj, _ = Fornecedor.objects.get_or_create(nome=nome)
        med.fornecedor_fk = fornecedor_obj
        med.save(update_fields=["fornecedor_fk"])


def backwards(apps, schema_editor):
    Medicamento = apps.get_model("farmacia", "Medicamento")

    for med in Medicamento.objects.select_related("fornecedor_fk").all().iterator():
        if med.fornecedor_fk_id:
            med.fornecedor = med.fornecedor_fk.nome
            med.save(update_fields=["fornecedor"])


class Migration(migrations.Migration):

    dependencies = [
        ("farmacia", "0005_medicamento_fornecedor_fk"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]