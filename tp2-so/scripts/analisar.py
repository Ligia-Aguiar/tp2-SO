#!/usr/bin/env python3
"""TP2 - SO: le dados/*.csv e gera figuras/*.png e dados/resumo.json (tabelas do relatorio)."""
import json, os, sys
import numpy as np, pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
D = lambda f: os.path.join(RAIZ, "dados", f)
F = lambda f: os.path.join(RAIZ, "figuras", f)
os.makedirs(F(""), exist_ok=True)

plt.rcParams.update({"font.family": "serif", "font.serif": ["Liberation Serif", "Times New Roman", "DejaVu Serif"],
                     "font.size": 8, "axes.grid": True, "grid.alpha": 0.3, "axes.titlesize": 8.5,
                     "axes.labelsize": 8, "legend.fontsize": 7, "figure.dpi": 200})
AZ, VM, VD, LJ = "#1f4e79", "#b03a2e", "#2e7d32", "#e08a00"

def ms(x, d=2):  # numero em formato pt-BR
    return f"{x:.{d}f}".replace(".", ",")

res = {}
# ----------------------------------------------------------------- Questao 1
def carrega(f):
    df = pd.read_csv(D(f)); df["cpu_s"] = df.user_s + df.sys_s; df["cs"] = df.nvcsw + df.nivcsw
    return df

def agrega(df):
    g = df.groupby("m")
    a = pd.DataFrame({
        "T": g.T_s.mean(), "sd": g.T_s.std(ddof=1), "lam": g.vazao.mean(), "lam_sd": g.vazao.std(ddof=1),
        "lat": g.lat_ms.mean(), "lat_sd": g.lat_ms.std(ddof=1), "cpu": g.cpu_s.mean(), "cs": g.cs.mean(),
        "n": g.size()})
    a["cv"] = 100 * a.sd / a["T"]
    a["cpu_pct"] = 100 * a.cpu / a["T"]
    return a

c1, c2, c3 = carrega("q1_cenario1.csv"), carrega("q1_cenario2.csv"), carrega("q1_cenario3_R200.csv")
c3_20 = carrega("q1_cenario3.csv")  # R = 20 (so para reportar o CV)
s2, s8 = carrega("q1_sens_C2.csv"), carrega("q1_sens_C8.csv")
a1, a2, a3, as2, as8 = agrega(c1), agrega(c2), agrega(c3), agrega(s2), agrega(s8)
a3_20 = agrega(c3_20)
for a in (a1, a2):
    a["S_lit"] = a["T"].iloc[0] / a["T"]
    a["S"] = a.lam / a.lam.iloc[0]
    a["E"] = a.S / a.index.values
a3["por_volta_us"] = a3["T"] / (a3.index.values * 200) * 1e6
a3["cs_volta"] = a3.cs / (a3.index.values * 200)
a3["cpu_volta_us"] = a3.cpu / (a3.index.values * 200) * 1e6

viol_q1 = int(sum(d.viol.sum() for d in (c1, c2, c3, c3_20, s2, s8)))
runs_q1 = int(sum(len(d) for d in (c1, c2, c3, c3_20, s2, s8)))
res["q1_viol"] = viol_q1; res["q1_runs"] = runs_q1
res["q1_cv_max"] = {k: float(a.cv.max()) for k, a in (("c1", a1), ("c2", a2), ("c3", a3), ("c3_R20", a3_20), ("s2", as2), ("s8", as8))}
res["q1_cv_gt5"] = {k: [int(m) for m in a.index[a.cv > 5]] for k, a in (("c1", a1), ("c2", a2), ("c3", a3), ("c3_R20", a3_20), ("s2", as2), ("s8", as8))}

def linhas_q1(a):
    out = []
    for m, r in a.iterrows():
        out.append([str(m), ms(r["T"], 3), ms(r.cv, 1), ms(r.lam, 0), ms(r.S_lit, 2), ms(r.S, 2), ms(r.E, 2), ms(r.lat, 1)])
    return out
res["t_c1"], res["t_c2"] = linhas_q1(a1), linhas_q1(a2)
res["t_c3"] = [[str(m), ms(r["T"] * 1000, 2), ms(r.cv, 1), ms(r.por_volta_us, 0), ms(r.cpu_volta_us, 0), ms(r.cs_volta, 1)]
               for m, r in a3.iterrows()]
res["t_sens"] = [[str(m), ms(as2.lam[m], 0), ms(a2.lam[m], 0), ms(as8.lam[m], 0)] for m in a2.index]
res["q1_cpu_c2"] = {str(m): ms(r.cpu_pct, 1) for m, r in a2.iterrows()}
res["q1_cs_c2"] = {str(m): ms(r.cs, 0) for m, r in a2.iterrows()}

M = a1.index.values
# Figura Q1 (2x2)
fig, ax = plt.subplots(2, 2, figsize=(6.3, 4.6))
ax[0, 0].errorbar(M, a1["T"], yerr=a1.sd, marker="o", ms=3, color=AZ, capsize=2, label="Cenário 1 (n = 200)")
ax[0, 0].errorbar(M, a2["T"], yerr=a2.sd, marker="s", ms=3, color=VM, capsize=2, label="Cenário 2 (n = 2mC)")
ax[0, 0].set(title="(a) Tempo total T(m)", xlabel="Número de carros m", ylabel="T (s)"); ax[0, 0].legend()
ax[0, 1].errorbar(M, a1.lam, yerr=a1.lam_sd, marker="o", ms=3, color=AZ, capsize=2, label="Cenário 1")
ax[0, 1].errorbar(M, a2.lam, yerr=a2.lam_sd, marker="s", ms=3, color=VM, capsize=2, label="Cenário 2")
ax[0, 1].plot(M, a1.lam.iloc[0] * M, "--", color="gray", lw=0.8, label="Ideal (linear)")
ax[0, 1].set(title="(b) Vazão λ(m)", xlabel="Número de carros m", ylabel="passageiros/s"); ax[0, 1].legend()
ax[1, 0].plot(M, a1.E, "o-", ms=3, color=AZ, label="Cenário 1"); ax[1, 0].plot(M, a2.E, "s-", ms=3, color=VM, label="Cenário 2")
ax[1, 0].set(title="(c) Eficiência E(m) = λ(m) / (m·λ(1))", xlabel="Número de carros m", ylabel="E", ylim=(0, 1.1)); ax[1, 0].legend()
ax[1, 1].errorbar(M, a1.lat, yerr=a1.lat_sd, marker="o", ms=3, color=AZ, capsize=2, label="Cenário 1")
ax[1, 1].errorbar(M, a2.lat, yerr=a2.lat_sd, marker="s", ms=3, color=VM, capsize=2, label="Cenário 2")
ax[1, 1].set(title="(d) Latência de espera do passageiro", xlabel="Número de carros m", ylabel="ms"); ax[1, 1].legend()
fig.tight_layout(); fig.savefig(F("fig_q1_a.png")); plt.close(fig)

# Figura Q1 (cenario 3 + sensibilidade)
fig, ax = plt.subplots(1, 3, figsize=(6.3, 2.2))
ax[0].plot(M, a3.por_volta_us, "o-", ms=3, color=AZ)
ax[0].set(title="(a) Tempo por volta (tL=tR=tU=0)", xlabel="m", ylabel="T/(m·R) (µs)")
ax[1].plot(M, a3.cs_volta, "o-", ms=3, color=VM)
ax[1].set(title="(b) Trocas de contexto por volta", xlabel="m", ylabel="trocas/volta")
for a, c, lab, mk in ((as2, LJ, "C = 2", "^"), (a2, AZ, "C = 4", "o"), (as8, VD, "C = 8", "s")):
    ax[2].plot(M, a.lam, marker=mk, ms=3, color=c, label=lab)
ax[2].set(title="(c) Sensibilidade à capacidade", xlabel="m", ylabel="vazão (pass./s)"); ax[2].legend()
fig.tight_layout(); fig.savefig(F("fig_q1_b.png")); plt.close(fig)

# ----------------------------------------------------------------- Questao 2
q2 = pd.read_csv(D("q2.csv"))
res["q2_runs"] = int(len(q2))
ok = q2[q2.variante != "nenhum"]
res["q2_viol_ok"] = int(ok.viol_dir.sum() + ok.viol_cap.sum())
res["q2_deadlock"] = int(q2.deadlock.sum())
res["q2_maxtotal_ok"] = int(ok.max_total.max())
v = q2[q2.exp == "V"]
res["q2_ctrl"] = {"runs": int(len(v)), "viol_dir_media": float(v.viol_dir.mean()), "viol_cap_media": float(v.viol_cap.mean()),
                  "runs_com_viol": int(((v.viol_dir + v.viol_cap) > 0).sum()), "max_total": int(v.max_total.max())}

def mdp(s, d=1): return f"{ms(s.mean(), d)} ± {ms(s.std(ddof=1), d)}"

A = q2[q2.exp == "A"].groupby("N")
res["t_q2a"] = [[str(n), mdp(g.T_s, 2), mdp(g.vazao, 1), mdp(g.espera_media_ms, 0), mdp(g.espera_p95_ms, 0),
                 mdp(g.espera_max_ms, 0), ms(g.trocas.mean(), 0)] for n, g in A]
B = q2[q2.exp == "B"].groupby(["p0", "variante"])
res["t_q2b"] = [[f"{p}/{100-p}", ("justo" if vr == "justo" else "ingênuo"), mdp(g.vazao, 1), mdp(g.espera_media_ms, 0),
                 mdp(g.espera_max_ms, 0), ms(g.trocas.mean(), 0)] for (p, vr), g in B]
Cc = q2[q2.exp == "C"].groupby("variante")
res["t_q2c"] = [[("justo" if vr == "justo" else "ingênuo"), mdp(g.vazao, 1), mdp(g.espera_media_d0, 0), mdp(g.espera_media_d1, 0),
                 mdp(g.espera_max_d1, 0), ms(g.trocas.mean(), 0)] for vr, g in Cc]
Dd = q2[q2.exp == "D"].groupby("taxa")
res["t_q2d"] = [[str(t), mdp(g.vazao, 1), mdp(g.espera_media_ms, 0), mdp(g.espera_p95_ms, 0)] for t, g in Dd]
res["q2_c_raw"] = {vr: {"d1_max_mean": float(g.espera_max_d1.mean()), "d1_max_max": float(g.espera_max_d1.max()),
                        "d1_mean": float(g.espera_media_d1.mean()), "d0_mean": float(g.espera_media_d0.mean()),
                        "vazao": float(g.vazao.mean()), "T": float(g["T_s"].mean())} for vr, g in Cc}

fig, ax = plt.subplots(1, 3, figsize=(6.3, 2.3))
ga = q2[q2.exp == "A"].groupby("N")
ax[0].errorbar(ga.vazao.mean().index, ga.vazao.mean(), yerr=ga.vazao.std(ddof=1), marker="o", ms=3, color=AZ, capsize=2)
ax[0].axhline(50, ls="--", color="gray", lw=0.8); ax[0].text(25, 51.5, "limite 5/T$_c$ = 50/s", fontsize=6.5, color="gray")
ax[0].set(title="(a) Vazão × carga (rajada)", xlabel="Babuínos N", ylabel="babuínos/s", ylim=(0, 60))
gd = q2[q2.exp == "D"].groupby("taxa")
ax[1].errorbar(gd.vazao.mean().index, gd.vazao.mean(), yerr=gd.vazao.std(ddof=1), marker="o", ms=3, color=AZ, capsize=2, label="vazão (babuínos/s)")
ax[1].plot([10, 25, 50, 100], [10, 25, 50, 100], ":", color="gray", lw=0.8, label="chegada")
ax[1].set(title="(b) Vazão × taxa de chegada", xlabel="chegadas/s", ylabel="babuínos/s"); ax[1].legend()
cj, ci = q2[(q2.exp == "C") & (q2.variante == "justo")], q2[(q2.exp == "C") & (q2.variante == "ingenuo")]
x = np.arange(2); w = 0.35
ax[2].bar(x - w / 2, [ci.espera_media_d1.mean() / 1000, ci.espera_max_d1.mean() / 1000], w, color=VM, label="ingênuo",
          yerr=[ci.espera_media_d1.std(ddof=1) / 1000, ci.espera_max_d1.std(ddof=1) / 1000], capsize=2)
ax[2].bar(x + w / 2, [cj.espera_media_d1.mean() / 1000, cj.espera_max_d1.mean() / 1000], w, color=AZ, label="justo",
          yerr=[cj.espera_media_d1.std(ddof=1) / 1000, cj.espera_max_d1.std(ddof=1) / 1000], capsize=2)
ax[2].set_xticks(x); ax[2].set_xticklabels(["espera média", "espera máxima"])
ax[2].set(title="(c) Espera da minoria (sentido 1)", ylabel="s"); ax[2].legend()
fig.tight_layout(); fig.savefig(F("fig_q2.png")); plt.close(fig)

# ----------------------------------------------------------------- Questao 3
q3 = pd.read_csv(D("q3.csv"))
res["t_q3"] = [[r.variante.replace("_", " ").replace("sincronizacao", "sincronização").replace("semaforos", "semáforos"),
                str(r.K), str(r.threads), str(r.tentativas), str(r.invalidas)] for r in q3.itertuples()]
res["q3_total_ok"] = int(q3[q3.variante == "semaforos"].tentativas.sum())
res["q3_inv_ok"] = int(q3[q3.variante == "semaforos"].invalidas.sum())
res["q3_ctrl"] = [int(q3[q3.variante != "semaforos"].tentativas.iloc[0]), int(q3[q3.variante != "semaforos"].invalidas.iloc[0])]
res["q3_exemplos"] = open(D("q3_exemplos.txt"), encoding="utf-8").read()

res["ambiente"] = open(D("ambiente.txt"), encoding="utf-8").read()
json.dump(res, open(D("resumo.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(json.dumps({k: res[k] for k in ("q1_viol", "q1_runs", "q1_cv_max", "q1_cv_gt5", "q2_viol_ok", "q2_deadlock", "q2_ctrl", "q3_ctrl")}, indent=1, ensure_ascii=False))
