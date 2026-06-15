from django.db import migrations


COUNTRIES = [
    ("IN", "India"),
    ("JP", "Japan"),
    ("NL", "Netherlands"),
    ("US", "United States"),
]


def load_countries(apps, schema_editor):
    Country = apps.get_model("content", "Country")
    for code, name in COUNTRIES:
        Country.objects.get_or_create(code=code, defaults={"name": name})


class Migration(migrations.Migration):
    dependencies = [
        ("content", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(load_countries, migrations.RunPython.noop),
    ]
