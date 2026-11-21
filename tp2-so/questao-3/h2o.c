/*
 * TP2 - Sistemas Operacionais (CEFET-MG) - Questao 3
 * Construindo H2O (semaforos POSIX + pthreads).
 *
 * Uso:
 *   ./h2o HOH                       -> executa a entrada dada e imprime a saida
 *   ./h2o -e K TENTATIVAS [SEMENTE] -> estresse: K moleculas embaralhadas, repetido
 *   ./h2o -x K TENTATIVAS [SEMENTE] -> igual a -e, porem SEM sincronizacao (valida o teste)
 * A saida e a ordem em que as threads invocam bond(). Ela e valida se, dividida em
 * grupos de 3, cada grupo tem exatamente um O e dois H.
 */
#define _GNU_SOURCE
#include <pthread.h>
#include <semaphore.h>
#include <stdatomic.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

/* ---------- sincronizacao ---------- */
static sem_t mutex_h2o;                  /* semaforo binario: pode ser liberado por outra thread */
static int oxigenio, hidrogenio;         /* threads esperando (protegidas por mutex_h2o)        */
static sem_t fila_o, fila_h;

/* barreira reutilizavel de 3 threads (duas fases), so com semaforos */
static sem_t b_mutex, b_cat1, b_cat2;
static int b_cont;

static int nosync;                       /* modo de validacao: ignora toda a sincronizacao */

static char *log_bond;
static atomic_int log_idx;
static sem_t bonds_feitos;

static void barreira(void) {
    sem_wait(&b_mutex);
    if (++b_cont == 3) { sem_wait(&b_cat2); sem_post(&b_cat1); }
    sem_post(&b_mutex);
    sem_wait(&b_cat1); sem_post(&b_cat1);        /* fase 1 */

    sem_wait(&b_mutex);
    if (--b_cont == 0) { sem_wait(&b_cat1); sem_post(&b_cat2); }
    sem_post(&b_mutex);
    sem_wait(&b_cat2); sem_post(&b_cat2);        /* fase 2 */
}

static void bond(char tipo) {
    int i = atomic_fetch_add(&log_idx, 1);
    log_bond[i] = tipo;
    sem_post(&bonds_feitos);
}

static void *oxigenio_thread(void *arg) {
    (void)arg;
    if (nosync) { bond('O'); return NULL; }
    sem_wait(&mutex_h2o);
    oxigenio++;
    if (hidrogenio >= 2) {                       /* molecula completa: libera 2 H e este O */
        sem_post(&fila_h); sem_post(&fila_h);
        hidrogenio -= 2;
        sem_post(&fila_o);
        oxigenio -= 1;
    } else sem_post(&mutex_h2o);
    sem_wait(&fila_o);
    bond('O');
    barreira();
    sem_post(&mutex_h2o);                        /* so o O libera: proxima molecula so depois do bond dos 3 */
    return NULL;
}

static void *hidrogenio_thread(void *arg) {
    (void)arg;
    if (nosync) { bond('H'); return NULL; }
    sem_wait(&mutex_h2o);
    hidrogenio++;
    if (hidrogenio >= 2 && oxigenio >= 1) {
        sem_post(&fila_h); sem_post(&fila_h);
        hidrogenio -= 2;
        sem_post(&fila_o);
        oxigenio -= 1;
    } else sem_post(&mutex_h2o);
    sem_wait(&fila_h);
    bond('H');
    barreira();
    return NULL;
}

static void inicia(int n) {
    sem_init(&mutex_h2o, 0, 1); sem_init(&fila_o, 0, 0); sem_init(&fila_h, 0, 0);
    sem_init(&b_mutex, 0, 1); sem_init(&b_cat1, 0, 0); sem_init(&b_cat2, 0, 1);
    sem_init(&bonds_feitos, 0, 0);
    oxigenio = hidrogenio = b_cont = 0;
    atomic_store(&log_idx, 0);
    log_bond = calloc(n + 1, 1);
}

/* retorna 1 se todos os grupos de 3 sao validos */
static int valida(const char *s, int n) {
    for (int g = 0; g + 3 <= n; g += 3) {
        int o = 0, h = 0;
        for (int k = 0; k < 3; k++) { if (s[g + k] == 'O') o++; else h++; }
        if (o != 1 || h != 2) return 0;
    }
    return 1;
}

/* executa a entrada; retorna numero de bonds concluidos e preenche log_bond */
static int executa(const char *entrada, int espera_completa) {
    int n = (int)strlen(entrada), no = 0, nh = 0;
    for (int i = 0; i < n; i++) { if (entrada[i] == 'O') no++; else nh++; }
    int moleculas = no < nh / 2 ? no : nh / 2;
    int esperados = nosync ? n : 3 * moleculas;
    inicia(n);
    pthread_t *th = malloc(n * sizeof(pthread_t));
    for (int i = 0; i < n; i++)
        pthread_create(&th[i], NULL, entrada[i] == 'O' ? oxigenio_thread : hidrogenio_thread, NULL);
    for (int i = 0; i < esperados; i++) sem_wait(&bonds_feitos);
    if (espera_completa && (nosync || (no * 2 == nh))) {
        for (int i = 0; i < n; i++) pthread_join(th[i], NULL);
    } else usleep(100000);                       /* da tempo para o resto bloquear */
    free(th);
    return esperados;
}

static void embaralha(char *s, int n, unsigned *seed) {
    for (int i = n - 1; i > 0; i--) {
        int j = rand_r(seed) % (i + 1);
        char t = s[i]; s[i] = s[j]; s[j] = t;
    }
}

int main(int argc, char **argv) {
    if (argc >= 4 && (!strcmp(argv[1], "-e") || !strcmp(argv[1], "-x"))) {
        nosync = !strcmp(argv[1], "-x");
        int K = atoi(argv[2]), tent = atoi(argv[3]);
        unsigned seed = argc > 4 ? (unsigned)atoi(argv[4]) : 1;
        int n = 3 * K, invalidas = 0;
        char *ent = malloc(n + 1);
        for (int t = 0; t < tent; t++) {
            for (int i = 0; i < K; i++) { ent[3 * i] = 'O'; ent[3 * i + 1] = 'H'; ent[3 * i + 2] = 'H'; }
            ent[n] = 0;
            embaralha(ent, n, &seed);
            int e = executa(ent, 1);
            if (!valida(log_bond, e)) invalidas++;
            free(log_bond);
        }
        printf("%s,%d,%d,%d,%d\n", nosync ? "sem_sincronizacao" : "semaforos", K, n, tent, invalidas);
        return invalidas ? 1 : 0;
    }
    if (argc != 2) { fprintf(stderr, "uso: %s ENTRADA | -e K TENT [SEMENTE] | -x K TENT [SEMENTE]\n", argv[0]); return 2; }
    for (const char *p = argv[1]; *p; p++)
        if (*p != 'H' && *p != 'O') { fprintf(stderr, "entrada deve conter apenas H e O\n"); return 2; }
    int e = executa(argv[1], 1);
    printf("Entrada: %s\nSaida:   %.*s\n%s\n", argv[1], e, log_bond,
           valida(log_bond, e) ? "[OK] todos os grupos de 3 tem 1 O e 2 H"
                               : "[ERRO] algum grupo de 3 e invalido");
    if (e < (int)strlen(argv[1]))
        printf("(%d thread(s) sem molecula completa permanecem bloqueadas, como esperado)\n",
               (int)strlen(argv[1]) - e);
    return 0;
}
