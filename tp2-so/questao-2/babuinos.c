/*
 * TP2 - Sistemas Operacionais (CEFET-MG) - Questao 2
 * Travessia dos babuinos (semaforos POSIX + pthreads).
 *
 * Uso: ./babuinos -n N -p P0 -t TC_MS -r TAXA -v VARIANTE -s SEMENTE
 *   N         total de babuinos
 *   P0        percentual de babuinos no sentido 0 (restante no sentido 1)
 *   TC_MS     tempo de travessia (ms), com variacao aleatoria de +-20%
 *   TAXA      chegadas por segundo (processo de Poisson); 0 = todos de uma vez
 *   VARIANTE  justo   : catraca FIFO + "interruptor" por sentido + capacidade (solucao)
 *             ingenuo : sem catraca (seguro, mas permite inanicao)
 *             nenhum  : sem sincronizacao (valida a sensibilidade do oraculo)
 * Saida: uma linha CSV (cabecalho em scripts/executar_q2.sh).
 */
#define _GNU_SOURCE
#include <math.h>
#include <pthread.h>
#include <semaphore.h>
#include <stdatomic.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#define CAP 5

static int N = 50, P0 = 50, TC_MS = 100, TAXA = 0;
static unsigned SEMENTE = 1;
enum { V_JUSTO, V_INGENUO, V_NENHUM };
static int variante = V_JUSTO;

/* ---- semaforo forte (FIFO): garante que ninguem seja ultrapassado indefinidamente ---- */
typedef struct fnode { sem_t s; struct fnode *next; } fnode;
typedef struct { pthread_mutex_t m; int busy; fnode *head, *tail; } fifo_t;

static void fifo_wait(fifo_t *f) {
    pthread_mutex_lock(&f->m);
    if (!f->busy) { f->busy = 1; pthread_mutex_unlock(&f->m); return; }
    fnode n; sem_init(&n.s, 0, 0); n.next = NULL;
    if (f->tail) f->tail->next = &n; else f->head = &n;
    f->tail = &n;
    pthread_mutex_unlock(&f->m);
    sem_wait(&n.s);                 /* a posse da catraca e transferida diretamente */
    sem_destroy(&n.s);
}
static void fifo_post(fifo_t *f) {
    pthread_mutex_lock(&f->m);
    if (f->head) {
        fnode *n = f->head;
        f->head = n->next;
        if (!f->head) f->tail = NULL;
        sem_post(&n->s);            /* busy permanece 1: passa o bastao ao primeiro da fila */
    } else f->busy = 0;
    pthread_mutex_unlock(&f->m);
}

/* ---- sincronizacao da solucao ---- */
static fifo_t catraca = { PTHREAD_MUTEX_INITIALIZER, 0, NULL, NULL };
static sem_t corda_livre;           /* 1 = ninguem na corda / nenhum sentido "dono" */
static sem_t capacidade;            /* no maximo 5 na corda                         */
static pthread_mutex_t mtx_sentido[2] = { PTHREAD_MUTEX_INITIALIZER, PTHREAD_MUTEX_INITIALIZER };
static int cont[2];                 /* babuinos do sentido d que ja "pegaram" a corda */

/* ---- oraculo (mutex independente da solucao) ---- */
static pthread_mutex_t orac = PTHREAD_MUTEX_INITIALIZER;
static int na_corda[2], max_total, viol_dir, viol_cap, trocas, ultimo_sentido = -1;
static int esperando, concluidos;
static long long ultimo_progresso;

typedef struct { int d; long long t_cheg, t_ent, t_sai; unsigned seed; } babuino_t;

static long long now_ns(void) {
    struct timespec t; clock_gettime(CLOCK_MONOTONIC, &t);
    return t.tv_sec * 1000000000LL + t.tv_nsec;
}

static void atravessa(int d, unsigned *seed) {
    pthread_mutex_lock(&orac);
    na_corda[d]++;
    int total = na_corda[0] + na_corda[1];
    if (na_corda[1 - d] > 0) viol_dir++;
    if (total > CAP) viol_cap++;
    if (total > max_total) max_total = total;
    if (ultimo_sentido != d) { trocas++; ultimo_sentido = d; }
    esperando--;
    pthread_mutex_unlock(&orac);

    double f = 0.8 + 0.4 * (rand_r(seed) / (double)RAND_MAX);   /* +-20% */
    usleep((useconds_t)(TC_MS * 1000.0 * f));

    pthread_mutex_lock(&orac);
    na_corda[d]--;
    concluidos++;
    ultimo_progresso = now_ns();
    pthread_mutex_unlock(&orac);
}

static void *babuino(void *arg) {
    babuino_t *b = arg;
    int d = b->d;
    b->t_cheg = now_ns();
    pthread_mutex_lock(&orac); esperando++; pthread_mutex_unlock(&orac);

    if (variante != V_NENHUM) {
        if (variante == V_JUSTO) fifo_wait(&catraca);
        pthread_mutex_lock(&mtx_sentido[d]);
        if (++cont[d] == 1) sem_wait(&corda_livre);   /* primeiro do sentido toma a corda */
        pthread_mutex_unlock(&mtx_sentido[d]);
        if (variante == V_JUSTO) fifo_post(&catraca);
        sem_wait(&capacidade);
    }
    b->t_ent = now_ns();
    atravessa(d, &b->seed);
    b->t_sai = now_ns();
    if (variante != V_NENHUM) {
        sem_post(&capacidade);
        pthread_mutex_lock(&mtx_sentido[d]);
        if (--cont[d] == 0) sem_post(&corda_livre);   /* ultimo do sentido devolve a corda */
        pthread_mutex_unlock(&mtx_sentido[d]);
    }
    return NULL;
}

static babuino_t *bs;
static atomic_int terminou;

static void imprime(double T, int deadlock);

static void *watchdog(void *arg) {
    (void)arg;
    while (!atomic_load(&terminou)) {
        usleep(100000);
        pthread_mutex_lock(&orac);
        int susp = esperando > 0 && na_corda[0] + na_corda[1] == 0 &&
                   now_ns() - ultimo_progresso > 10000000000LL;
        pthread_mutex_unlock(&orac);
        if (susp) { imprime(0, 1); exit(2); }
    }
    return NULL;
}

static int cmp_d(const void *a, const void *b) {
    double x = *(const double *)a, y = *(const double *)b;
    return (x > y) - (x < y);
}

static void imprime(double T, int deadlock) {
    double *w = malloc(N * sizeof(double));
    double soma = 0, s0 = 0, s1 = 0, m0 = 0, m1 = 0;
    int n0 = 0, n1 = 0;
    for (int i = 0; i < N; i++) {
        if (bs[i].t_ent == 0) { w[i] = 0; continue; }
        double x = (bs[i].t_ent - bs[i].t_cheg) / 1e6;     /* ms */
        w[i] = x; soma += x;
        if (bs[i].d == 0) { s0 += x; n0++; if (x > m0) m0 = x; }
        else              { s1 += x; n1++; if (x > m1) m1 = x; }
    }
    qsort(w, N, sizeof(double), cmp_d);
    double p95 = w[(int)(0.95 * (N - 1))], mx = w[N - 1];
    const char *nome[] = { "justo", "ingenuo", "nenhum" };
    printf("%s,%d,%d,%d,%d,%u,%.4f,%.3f,%.2f,%.2f,%.2f,%.2f,%.2f,%.2f,%.2f,%d,%d,%d,%d,%d,%d\n",
           nome[variante], N, P0, TC_MS, TAXA, SEMENTE, T, T > 0 ? N / T : 0.0,
           soma / N, p95, mx, n0 ? s0 / n0 : 0, n1 ? s1 / n1 : 0, m0, m1,
           max_total, viol_dir, viol_cap, trocas, n0, deadlock);
    fflush(stdout);
    free(w);
}

int main(int argc, char **argv) {
    for (int i = 1; i + 1 < argc; i += 2) {
        if (!strcmp(argv[i], "-n")) N = atoi(argv[i + 1]);
        else if (!strcmp(argv[i], "-p")) P0 = atoi(argv[i + 1]);
        else if (!strcmp(argv[i], "-t")) TC_MS = atoi(argv[i + 1]);
        else if (!strcmp(argv[i], "-r")) TAXA = atoi(argv[i + 1]);
        else if (!strcmp(argv[i], "-s")) SEMENTE = (unsigned)atoi(argv[i + 1]);
        else if (!strcmp(argv[i], "-v")) {
            if (!strcmp(argv[i + 1], "justo")) variante = V_JUSTO;
            else if (!strcmp(argv[i + 1], "ingenuo")) variante = V_INGENUO;
            else if (!strcmp(argv[i + 1], "nenhum")) variante = V_NENHUM;
            else { fprintf(stderr, "variante invalida\n"); return 2; }
        }
    }
    sem_init(&corda_livre, 0, 1);
    sem_init(&capacidade, 0, CAP);
    bs = calloc(N, sizeof(babuino_t));
    pthread_t *th = malloc(N * sizeof(pthread_t));
    pthread_attr_t at; pthread_attr_init(&at); pthread_attr_setstacksize(&at, 128 * 1024);

    unsigned seed = SEMENTE;
    ultimo_progresso = now_ns();
    pthread_t wd; pthread_create(&wd, NULL, watchdog, NULL);

    long long t0 = now_ns();
    for (int i = 0; i < N; i++) {
        bs[i].d = (int)(rand_r(&seed) % 100) < P0 ? 0 : 1;
        bs[i].seed = rand_r(&seed);
        pthread_create(&th[i], &at, babuino, &bs[i]);
        if (TAXA > 0) {                       /* chegadas de Poisson */
            double u = (rand_r(&seed) + 1.0) / ((double)RAND_MAX + 2.0);
            usleep((useconds_t)(-log(u) / TAXA * 1e6));
        }
    }
    for (int i = 0; i < N; i++) pthread_join(th[i], NULL);
    double T = (now_ns() - t0) / 1e9;
    atomic_store(&terminou, 1);
    pthread_join(wd, NULL);
    imprime(T, 0);
    return (viol_dir || viol_cap) ? 1 : 0;
}
