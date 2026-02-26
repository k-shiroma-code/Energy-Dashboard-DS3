// index.js (ES module)

const stats = [
  { label: "Forecast horizon", value: "10 years" },
  { label: "Datasets", value: "EV + energy" },
  { label: "Visuals", value: "D3-ready" },
  { label: "Focus", value: "Top 20 by year" }
];

const projects = [
  {
    title: "EV Sales Share Explorer",
    meta: "Interactive ranking • Year filter • Top 20 countries",
    description:
      "Explore EV sales share by year and rank countries dynamically. Built for your EnergyDashboard workflow.",
    links: [
      { label: "Open Demo", href: "./ev-share.html" },
      { label: "GitHub", href: "https://github.com" }
    ]
  },
  {
    title: "EV Forecast Dashboard",
    meta: "Predictive series • Scrollytelling (planned)",
    description:
      "Forecast EV adoption and compare scenarios. Add brush/slider to pick years like 2030 and render top 20.",
    links: [
      { label: "Design Notes", href: "#about" }
    ]
  },
  {
    title: "Global Oil Trade Insights",
    meta: "Network + flows • Risk insights",
    description:
      "Trade flow summaries and indicators designed for quick, decision-ready interpretation.",
    links: [
      { label: "Read More", href: "#about" }
    ]
  }
];

function renderStats() {
  const el = document.querySelector("#profile-stats");
  if (!el) return;

  const dl = document.createElement("dl");

  for (const s of stats) {
    const dt = document.createElement("dt");
    dt.textContent = s.value;

    const dd = document.createElement("dd");
    dd.textContent = s.label;

    dl.appendChild(dt);
    dl.appendChild(dd);
  }

  el.innerHTML = "";
  el.appendChild(dl);
}

function renderProjects() {
  const grid = document.querySelector("#projects-grid");
  if (!grid) return;

  grid.innerHTML = "";

  for (const p of projects) {
    const article = document.createElement("article");

    const h3 = document.createElement("h3");
    h3.className = "project-title";
    h3.textContent = p.title;

    const meta = document.createElement("div");
    meta.className = "project-meta";
    meta.textContent = p.meta;

    const desc = document.createElement("p");
    desc.textContent = p.description;

    const linksWrap = document.createElement("div");
    linksWrap.className = "project-links";

    for (const link of p.links) {
      const a = document.createElement("a");
      a.href = link.href;
      a.textContent = link.label;

      // external links open new tab
      if (a.href.startsWith("http")) {
        a.target = "_blank";
        a.rel = "noopener";
      }

      linksWrap.appendChild(a);
    }

    article.appendChild(h3);
    article.appendChild(meta);
    article.appendChild(desc);
    article.appendChild(linksWrap);
    grid.appendChild(article);
  }
}

function renderYear() {
  const y = document.querySelector("#year");
  if (y) y.textContent = String(new Date().getFullYear());
}

renderStats();
renderProjects();
renderYear();
