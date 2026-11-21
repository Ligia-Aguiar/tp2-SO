/*
 * TP2 - Sistemas Operacionais (CEFET-MG) - Questao 1
 * Problema da montanha-russa com varios carros (semaforos POSIX + pthreads).
 *
 * Uso: ./montanha_russa m C n R tL_us tR_us tU_us
 *   m = carros, C = capacidade, n = passageiros, R = voltas por carro,
 *   tL/tR/tU = duracao simulada de load/run/unload (microssegundos).
 * Saida: uma linha CSV (cabecalho em scripts/executar_q1.sh).
 * Codigo de saida: 0 = sem violacoes; 1 = alguma restricao violada.
 */
#define _GNU_SOURCE
#include <pthread.h>
#include <semaphore.h>
#include <stdatomic.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <unistd.h>
#include <sys/resource.h>

enum { IDLE, LOADING, RUNNING, UNLOADING };

static int M, C, N, R;
static long tL, tR, tU;

/* --- sincronizacao (solucao) --- */
static sem_t load_q;                   /* passageiros esperam o load (global)       */
static sem_t all_aboard;               /* ultimo a embarcar avisa o carro           */
static sem_t *unload_q, *all_ashore;   /* por carro: so os passageiros DAQUELE carro */
static sem_t *load_turn, *unload_turn; /* anel: ordem de embarque / desembarque     */
static pthread_mutex_t mtx_board = PTHREAD_MUTEX_INITIALIZER;
static pthread_mutex_t *mtx_unb;
static int boarders;
static int *unboarders;
static atomic_int loading_car;         /* carro que esta embarcando agora           */
static atomic_int done;
static pthread_barrier_t start_bar;

/* --- oraculo de verificacao (so atomicos; nao interfere na solucao) --- */
static atomic_int *state, *in_car;
static int *ticket;
static atomic_int load_seq, unload_next;
static atomic_int v_board, v_depart, v_unboard, v_order, v_incomplete;

/* --- metricas --- */
static atomic_llong lat_sum_ns, lat_cnt;

static long long now_ns(void) {
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return t.tv_sec * 1000000000LL + t.tv_nsec;
}
static void usleep_if(long us) { if (us > 0) usleep(us); }

/* ---------- operacoes do enunciado ---------- */
static void board(int c) {             /* passageiro embarca no carro c */
    if (atomic_load(&state[c]) != LOADING) atomic_fetch_add(&v_board, 1);
    atomic_fetch_add(&in_car[c], 1);
}
static void unboard(int c) {           /* passageiro desembarca do carro c */
    if (atomic_load(&state[c]) != UNLOADING) atomic_fetch_add(&v_unboard, 1);
    atomic_fetch_sub(&in_car[c], 1);
}
static void car_load(int i) {
    ticket[i] = atomic_fetch_add(&load_seq, 1);
    atomic_store(&state[i], LOADING);
    atomic_store(&loading_car, i);
    usleep_if(tL);
    for (int k = 0; k < C; k++) sem_post(&load_q);
    sem_wait(&all_aboard);             /* so segue com C passageiros a bordo */
}
static void car_run(int i) {
    if (atomic_load(&in_car[i]) != C) atomic_fetch_add(&v_depart, 1);
    atomic_store(&state[i], RUNNING);
    usleep_if(tR);
}
static void car_unload(int i) {
    if (ticket[i] != atomic_load(&unload_next)) atomic_fetch_add(&v_order, 1);
    atomic_store(&state[i], UNLOADING);
    usleep_if(tU);
    for (int k = 0; k < C; k++) sem_post(&unload_q[i]);
    sem_wait(&all_ashore[i]);          /* todos os C desembarcaram */
    if (atomic_load(&in_car[i]) != 0) atomic_fetch_add(&v_incomplete, 1);
    atomic_store(&state[i], IDLE);
    atomic_fetch_add(&unload_next, 1);
}

/* ---------- threads ---------- */
static void *car_thread(void *arg) {
    int i = (int)(long)arg;
    pthread_barrier_wait(&start_bar);
    for (int lap = 0; lap < R; lap++) {
        sem_wait(&load_turn[i]);                /* um carro embarcando por vez   */
        car_load(i);
        sem_post(&load_turn[(i + 1) % M]);      /* proximo carro pode embarcar   */
        car_run(i);
        sem_wait(&unload_turn[i]);              /* desembarque na ordem de embarque */
        car_unload(i);
        sem_post(&unload_turn[(i + 1) % M]);
    }
    return NULL;
}

static void *passenger_thread(void *arg) {
    (void)arg;
    long long lsum = 0, lcnt = 0;
    pthread_barrier_wait(&start_bar);
    while (!atomic_load(&done)) {
        long long t0 = now_ns();
        sem_wait(&load_q);
        if (atomic_load(&done)) break;
        int c = atomic_load(&loading_car);      /* lido antes de contar o embarque */
        board(c);
        lsum += now_ns() - t0;
        lcnt++;
        pthread_mutex_lock(&mtx_board);
        if (++boarders == C) { boarders = 0; sem_post(&all_aboard); }
        pthread_mutex_unlock(&mtx_board);

        sem_wait(&unload_q[c]);
        unboard(c);
        pthread_mutex_lock(&mtx_unb[c]);
        if (++unboarders[c] == C) { unboarders[c] = 0; sem_post(&all_ashore[c]); }
        pthread_mutex_unlock(&mtx_unb[c]);
    }
    atomic_fetch_add(&lat_sum_ns, lsum);
    atomic_fetch_add(&lat_cnt, lcnt);
    return NULL;
}

int main(int argc, char **argv) {
    if (argc != 8) {
        fprintf(stderr, "uso: %s m C n R tL_us tR_us tU_us\n", argv[0]);
        return 2;
    }
    M = atoi(argv[1]); C = atoi(argv[2]); N = atoi(argv[3]); R = atoi(argv[4]);
    tL = atol(argv[5]); tR = atol(argv[6]); tU = atol(argv[7]);
    if (M < 1 || C < 1 || N <= C) {
        fprintf(stderr, "parametros invalidos (exige n > C)\n");
        return 2;
    }

    sem_init(&load_q, 0, 0);
    sem_init(&all_aboard, 0, 0);
    unload_q = malloc(M * sizeof(sem_t));
    all_ashore = malloc(M * sizeof(sem_t));
    load_turn = malloc(M * sizeof(sem_t));
    unload_turn = malloc(M * sizeof(sem_t));
    mtx_unb = malloc(M * sizeof(pthread_mutex_t));
    unboarders = calloc(M, sizeof(int));
    state = calloc(M, sizeof(atomic_int));
    in_car = calloc(M, sizeof(atomic_int));
    ticket = calloc(M, sizeof(int));
    for (int i = 0; i < M; i++) {
        sem_init(&unload_q[i], 0, 0);
        sem_init(&all_ashore[i], 0, 0);
        sem_init(&load_turn[i], 0, i == 0);     /* o carro 0 embarca primeiro */
        sem_init(&unload_turn[i], 0, i == 0);
        pthread_mutex_init(&mtx_unb[i], NULL);
    }
    pthread_barrier_init(&start_bar, NULL, M + N + 1);

    pthread_attr_t at;
    pthread_attr_init(&at);
    pthread_attr_setstacksize(&at, 128 * 1024);
    pthread_t *cars = malloc(M * sizeof(pthread_t)), *pas = malloc(N * sizeof(pthread_t));
    for (int i = 0; i < M; i++) pthread_create(&cars[i], &at, car_thread, (void *)(long)i);
    for (int i = 0; i < N; i++) pthread_create(&pas[i], &at, passenger_thread, NULL);

    struct rusage r0, r1;
    getrusage(RUSAGE_SELF, &r0);
    long long t_ini = now_ns();
    pthread_barrier_wait(&start_bar);           /* libera todas as threads */

    for (int i = 0; i < M; i++) pthread_join(cars[i], NULL);
    long long t_fim = now_ns();
    getrusage(RUSAGE_SELF, &r1);

    atomic_store(&done, 1);                     /* encerra passageiros bloqueados */
    for (int i = 0; i < N; i++) sem_post(&load_q);
    for (int i = 0; i < N; i++) pthread_join(pas[i], NULL);

    double T = (t_fim - t_ini) / 1e9;
    double lambda = (double)M * R * C / T;
    long long lc = atomic_load(&lat_cnt);
    double lat_ms = lc ? atomic_load(&lat_sum_ns) / (double)lc / 1e6 : 0;
    double ut = (r1.ru_utime.tv_sec - r0.ru_utime.tv_sec) + (r1.ru_utime.tv_usec - r0.ru_utime.tv_usec) / 1e6;
    double st = (r1.ru_stime.tv_sec - r0.ru_stime.tv_sec) + (r1.ru_stime.tv_usec - r0.ru_stime.tv_usec) / 1e6;
    int viol = v_board + v_depart + v_unboard + v_order + v_incomplete;
    printf("%d,%d,%d,%d,%ld,%ld,%ld,%.6f,%.3f,%.4f,%.4f,%.4f,%ld,%ld,%d,%d,%d,%d,%d,%d\n",
           M, C, N, R, tL, tR, tU, T, lambda, lat_ms, ut, st,
           r1.ru_nvcsw - r0.ru_nvcsw, r1.ru_nivcsw - r0.ru_nivcsw,
           viol, v_board, v_depart, v_unboard, v_order, v_incomplete);
    return viol ? 1 : 0;
}
