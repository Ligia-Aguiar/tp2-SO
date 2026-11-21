# TP2 – Sistemas Operacionais (CEFET-MG)

Sincronização com semáforos POSIX e pthreads. Professora: Michelle Hanne.
Autores: Ligia Cristina Aguiar Benedito e Pedro Fortunato Oliveira.

| Pasta | Conteúdo |
|---|---|
| `questao-1/` | Montanha-russa com vários carros (`montanha_russa.c`) |
| `questao-2/` | Travessia dos babuínos (`babuinos.c`) |
| `questao-3/` | Construindo H2O (`h2o.c`) |
| `scripts/` | `executar_tudo.sh` (compila e roda todos os experimentos) e `analisar.py` (tabelas e gráficos) |
| `dados/` | CSVs brutos gerados pelos experimentos e `ambiente.txt` (máquina usada) |
| `figuras/` | Gráficos usados no relatório |

## Compilar

```bash
gcc -O2 -Wall -pthread -o questao-1/montanha_russa questao-1/montanha_russa.c
gcc -O2 -Wall -pthread -o questao-2/babuinos       questao-2/babuinos.c -lm
gcc -O2 -Wall -pthread -o questao-3/h2o            questao-3/h2o.c
```

## Executar

```bash
# Q1: m C n R tL_us tR_us tU_us   (imprime uma linha CSV; código de saída 1 se alguma restrição for violada)
./questao-1/montanha_russa 5 4 40 20 1000 10000 1000

# Q2: -n babuínos -p %sentido0 -t Tc_ms -r chegadas/s (0 = rajada) -v justo|ingenuo|nenhum -s semente
./questao-2/babuinos -n 100 -p 50 -t 100 -r 0 -v justo -s 1

# Q3: entrada direta, ou estresse (-e) / controle sem sincronização (-x): K moléculas, tentativas, semente
./questao-3/h2o HOH
./questao-3/h2o OOHHHH
./questao-3/h2o -e 100 300 7
./questao-3/h2o -x 100 300 7
```

## Reproduzir todos os experimentos

```bash
bash scripts/executar_tudo.sh 30 10     # 30 repetições (Q1) e 10 (Q2); leva ~25 min
python3 scripts/analisar.py             # requer numpy, pandas e matplotlib
```
Para medições confiáveis, feche outros programas e rode a máquina o mais ociosa possível.
