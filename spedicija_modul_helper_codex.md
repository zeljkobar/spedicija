# Modul za spediciju i profit po kontejneru

## Cilj

Web aplikacija prati prihode, troskove i profit po spediterskoj poziciji. Glavni identifikator pozicije je broj kontejnera, na primjer `MSCU1234567`.

Pozicija predstavlja jedan kontejnerski posao. Fakture i dodatni troskovi se vezuju za poziciju, a aplikacija racuna:

```text
profit = ukupni prihodi - ukupni troskovi
```

Prihod cine izlazne fakture. Trosak cine ulazne fakture i dodatni troskovi.

## Glavni moduli

1. Dashboard
2. Firme
3. Spediterske pozicije
4. Fakture
5. Dodatni troskovi
6. Izvjestaji
7. Korisnici i prava pristupa

## Tok unosa fakture

Unos fakture treba da bude wizard kroz vise koraka.

Korisnik klikne `+ Novi unos`, a aplikacija prvo pita:

```text
Da li se faktura odnosi na novu ili postojecu poziciju?

[ Nova pozicija / novi kontejner ]
[ Postojeca pozicija / postojeci kontejner ]
```

### Nova pozicija

Ako korisnik bira novu poziciju, prvo unosi osnovne podatke:

```text
Broj kontejnera
Firma / klijent
Datum otvaranja
Napomena
```

Backend mora normalizovati broj kontejnera i provjeriti da li pozicija vec postoji. Ako postoji, ne smije kreirati duplikat, vec treba vratiti upozorenje da se faktura moze dodati na postojecu poziciju.

### Postojeca pozicija

Ako korisnik bira postojecu poziciju, aplikacija prikazuje pretragu po:

```text
broju kontejnera
nazivu firme
statusu
datumu otvaranja
```

Nakon izbora pozicije otvara se ista forma za fakturu.

### Dodavanje sa kartice pozicije

Na kartici pozicije postoji dugme `+ Dodaj fakturu`. U tom slucaju se preskace izbor pozicije jer je pozicija vec poznata.

## Pravila za broj kontejnera

Broj kontejnera se prije cuvanja i pretrage normalizuje:

```text
trim
uppercase
uklanjanje razmaka
```

Primjer:

```text
" mscu 1234567 " -> "MSCU1234567"
```

U bazi mora postojati jedinstveno ogranicenje nad brojem kontejnera.

## Firme

Polja:

```text
id
naziv
pib
pdv_broj
adresa
grad
drzava
kontakt_osoba
telefon
email
tip_firme
napomena
created_at
updated_at
```

Tip firme:

```text
KLIJENT
DOBAVLJAC
BRODAR
PREVOZNIK
LUKA
AGENT
OSTALO
```

## Pozicije

Polja:

```text
id
broj_kontejnera
firma_id
naziv_pozicije
datum_otvaranja
datum_zatvaranja
status
polaziste
odrediste
brod
booking_broj
bl_broj
napomena
created_at
updated_at
```

Statusi:

```text
OTVORENA
U_TOKU
FAKTURISANA
NAPLACENA
ZATVORENA
STORNIRANA
```

Kartica pozicije prikazuje osnovne podatke, ulazne fakture, izlazne fakture, dodatne troskove, ukupne prihode, ukupne troskove, profit i profitnu marzu.

## Fakture

Tip fakture:

```text
ULAZNA
IZLAZNA
```

Polja:

```text
id
pozicija_id
firma_id
tip_fakture
broj_fakture
datum_fakture
datum_dospijeca
opis
iznos_bez_pdv
pdv_iznos
iznos_sa_pdv
valuta
status_placanja
napomena
created_at
updated_at
```

Status placanja:

```text
NEPLACENO
DJELIMICNO_PLACENO
PLACENO
STORNIRANO
```

Backend treba upozoriti na moguci duplikat kada vec postoji ista kombinacija:

```text
broj_fakture + firma_id + tip_fakture
```

## Dodatni troskovi

Polja:

```text
id
pozicija_id
opis
datum_troska
iznos
valuta
napomena
created_at
updated_at
```

Ovi troskovi ulaze u ukupan trosak pozicije.

## Izvjestaji

MVP izvjestaji:

1. Profit po kontejneru
2. Profit po firmi
3. Profit po periodu
4. Otvorene pozicije

Svaki izvjestaj treba da podrzi filtere i export u CSV. Excel export je sljedeci korak.

## Tehnologija

Predlozeni stack:

```text
Frontend: React + Vite
Backend: Node.js + Express
Baza: PostgreSQL
ORM: Prisma
Auth: JWT ili session auth
UI: Tailwind CSS ili Bootstrap
Export: CSV, kasnije ExcelJS
```

## MVP acceptance criteria

Aplikacija je funkcionalna kada korisnik moze da:

1. Doda firmu.
2. Otvori novu poziciju po broju kontejnera.
3. Izabere postojecu poziciju.
4. Unese ulaznu fakturu.
5. Unese izlaznu fakturu.
6. Vidi karticu pozicije sa prihodima, troskovima i profitom.
7. Pretrazi poziciju po broju kontejnera.
8. Vidi profit po kontejneru.
9. Vidi profit po firmi.
10. Izveze izvjestaj u CSV.

