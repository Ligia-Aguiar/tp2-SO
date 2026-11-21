#!/bin/bash
# TP2 - SO - executa todos os experimentos e grava os CSVs em dados/.
# Uso (na raiz do repositorio):  bash scripts/executar_tudo.sh [REPS_Q1] [REPS_Q2]
# Rode com a maquina o mais ociosa possivel (feche navegador etc.).
set -u
cd "$(dirname "$0")/.."
REPS1=${1:-30}     # repeticoes por configuracao na Questao 1 (enunciado: 30)
REPS2=${2:-10}     # repeticoes por configuracao na Questao 2
REPS_SENS=10       # repeticoes na analise de sensibilidade (C=2 e C=8)
mkdir -p dados

echo "== compilando =="
gcc -O2 -Wall -pthread -o questao-1/montanha_russa questao-1/montanha_russa.c || exit 1
gcc -O2 -Wall -pthread -o questao-2/babuinos questao-2/babuinos.c -lm          || exit 1
gcc -O2 -Wall -pthread -o questao-3/h2o questao-3/h2o.c                        || exit 1

{ echo "data: $(date -Iseconds)"; uname -a; lscpu | grep -E "Model name|^CPU\(s\)|Thread|Core|MHz"; free -h | head -2; gcc --version | head -1; } > dados/ambiente.txt

MS="1 2 5 10 15 20 25 30 40 50"
Q1=questao-1/montanha_russa
H1="cenario,rep,m,C,n,R,tL_us,tR_us,tU_us,T_s,vazao,lat_ms,user_s,sys_s,nvcsw,nivcsw,viol,v_board,v_depart,v_unboard,v_order,v_incomplete"
for f in q1_cenario1 q1_cenario2 q1_cenario3 q1_sens_C2 q1_sens_C8; do echo "$H1" > dados/$f.csv; done

echo "== Questao 1 =="
for rep in $(seq 1 "$REPS1"); do
  echo "  rodada $rep/$REPS1"
  for m in $MS; do
    echo "1,$rep,$($Q1 $m 4 200 20 1000 10000 1000)"            >> dados/q1_cenario1.csv   # n fixo = 200
    echo "2,$rep,$($Q1 $m 4 $((2*m*4)) 20 1000 10000 1000)"     >> dados/q1_cenario2.csv   # n = 2mC
    echo "3,$rep,$($Q1 $m 4 $((2*m*4)) 20 0 0 0)"               >> dados/q1_cenario3.csv   # sem trabalho simulado
  done
done
# cenario 3 complementar: R = 200 voltas (com R = 20 os tempos sao de poucos ms e o CV fica alto)
echo "$H1" > dados/q1_cenario3_R200.csv
for rep in $(seq 1 "$REPS1"); do
  for m in $MS; do
    echo "3,$rep,$($Q1 $m 4 $((2*m*4)) 200 0 0 0)" >> dados/q1_cenario3_R200.csv
  done
done
for rep in $(seq 1 "$REPS_SENS"); do
  for m in $MS; do
    echo "2,$rep,$($Q1 $m 2 $((2*m*2)) 20 1000 10000 1000)"     >> dados/q1_sens_C2.csv
    echo "2,$rep,$($Q1 $m 8 $((2*m*8)) 20 1000 10000 1000)"     >> dados/q1_sens_C8.csv
  done
done

Q2=questao-2/babuinos
H2="exp,rep,variante,N,p0,tc_ms,taxa,semente,T_s,vazao,espera_media_ms,espera_p95_ms,espera_max_ms,espera_media_d0,espera_media_d1,espera_max_d0,espera_max_d1,max_total,viol_dir,viol_cap,trocas,n_d0,deadlock"
echo "$H2" > dados/q2.csv
echo "== Questao 2 =="
for rep in $(seq 1 "$REPS2"); do
  echo "  rodada $rep/$REPS2"
  for N in 10 25 50 100 200; do                                   # A: carga crescente (rajada)
    echo "A,$rep,$($Q2 -n $N -p 50 -t 100 -r 0 -v justo -s $rep)" >> dados/q2.csv
  done
  for p in 50 80 95; do for v in justo ingenuo; do                # B: desbalanceamento (rajada)
    echo "B,$rep,$($Q2 -n 100 -p $p -t 100 -r 0 -v $v -s $rep)"   >> dados/q2.csv
  done; done
  for v in justo ingenuo; do                                      # C: fluxo continuo (inanicao)
    echo "C,$rep,$($Q2 -n 400 -p 97 -t 100 -r 48 -v $v -s $rep)"  >> dados/q2.csv
  done
  for r in 10 25 50 100; do                                       # D: taxa de chegada
    echo "D,$rep,$($Q2 -n 60 -p 50 -t 100 -r $r -v justo -s $rep)" >> dados/q2.csv
  done
  echo "V,$rep,$($Q2 -n 100 -p 50 -t 100 -r 0 -v nenhum -s $rep)" >> dados/q2.csv   # V: controle sem sincronizacao
done

echo "== Questao 3 =="
echo "variante,K,threads,tentativas,invalidas" > dados/q3.csv
for K in 1 2 10 100; do ./questao-3/h2o -e $K 300 11 >> dados/q3.csv; done
./questao-3/h2o -e 1000 20 12 >> dados/q3.csv
./questao-3/h2o -x 100 300 11 >> dados/q3.csv
./questao-3/h2o HOH         > dados/q3_exemplos.txt
./questao-3/h2o OOHHHH     >> dados/q3_exemplos.txt
./questao-3/h2o HHHOOH     >> dados/q3_exemplos.txt
./questao-3/h2o OHHHH      >> dados/q3_exemplos.txt
echo "== fim =="
