import React, { useEffect, useMemo, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://finshield-fraud-intelligence.onrender.com";

const initialTransactions = [
  {
    id: "TXN-92841",
    merchant: "Nova Electronics",
    amount: 8420,
    location: "Mumbai, IN",
    time: "2 min ago",
    risk: 91,
    status: "Blocked",
    reason: "Device + location anomaly",
  },
  {
    id: "TXN-92840",
    merchant: "Urban Mart",
    amount: 1240,
    location: "Indore, IN",
    time: "5 min ago",
    risk: 18,
    status: "Approved",
    reason: "Normal customer behavior",
  },
  {
    id: "TXN-92839",
    merchant: "QuickPay Services",
    amount: 18600,
    location: "Delhi, IN",
    time: "9 min ago",
    risk: 76,
    status: "Review",
    reason: "Unusual transaction velocity",
  },
  {
    id: "TXN-92838",
    merchant: "TravelNest",
    amount: 4390,
    location: "Bhopal, IN",
    time: "13 min ago",
    risk: 12,
    status: "Approved",
    reason: "Trusted device",
  },
  {
    id: "TXN-92837",
    merchant: "CryptoX Merchant",
    amount: 28900,
    location: "Pune, IN",
    time: "18 min ago",
    risk: 87,
    status: "Blocked",
    reason: "Coordinated account activity",
  },
];

function RiskBadge({ risk }) {
  const label =
    risk >= 80
      ? "Critical"
      : risk >= 60
      ? "High"
      : risk >= 30
      ? "Medium"
      : "Low";

  return (
    <span className={`risk-badge risk-${label.toLowerCase()}`}>
      <span className="risk-dot" />
      {risk}% {label}
    </span>
  );
}

function StatCard({ icon, title, value, change }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <div className="stat-icon">{icon}</div>
        <span className="stat-change">{change}</span>
      </div>

      <div className="stat-title">{title}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function App() {
  const [active, setActive] = useState("Overview");
  const [transactions, setTransactions] = useState(initialTransactions);
  const [search, setSearch] = useState("");
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [apiStatus, setApiStatus] = useState("Checking");

  /*
   * REAL BACKEND HEALTH CHECK
   * Checks /api/health instead of the Render root URL.
   */
  useEffect(() => {
    let mounted = true;

    const checkApi = async () => {
      try {
        const response = await fetch(`${API_URL}/api/health`, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        if (mounted) {
          setApiStatus("Online");
        }
      } catch (error) {
        console.error("FinShield API health check failed:", error);

        if (mounted) {
          setApiStatus("Offline");
        }
      }
    };

    checkApi();

    const interval = setInterval(checkApi, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const filteredTransactions = useMemo(() => {
    const q = search.toLowerCase().trim();

    if (!q) return transactions;

    return transactions.filter(
      (t) =>
        t.id.toLowerCase().includes(q) ||
        t.merchant.toLowerCase().includes(q) ||
        t.location.toLowerCase().includes(q)
    );
  }, [transactions, search]);

  const totalRisk = transactions.reduce((sum, t) => sum + t.risk, 0);

  const avgRisk =
    transactions.length > 0
      ? Math.round(totalRisk / transactions.length)
      : 0;

  /*
   * CURRENT DEMO ANALYSIS
   * This keeps the UI functional even if the backend analysis endpoint
   * is not yet connected.
   */
  const analyzeTransaction = () => {
    const value = Number(amount);

    if (!value || value <= 0) {
      setAnalysis({
        risk: 48,
        title: "Insufficient transaction data",
        description:
          "Enter a valid transaction amount for risk analysis.",
        factors: [
          "Transaction amount required",
          "Behavioral context unavailable",
        ],
      });

      return;
    }

    setAnalyzing(true);

    setTimeout(() => {
      let risk = Math.min(95, Math.round(12 + value / 1500));

      if (merchant.toLowerCase().includes("crypto")) {
        risk += 22;
      }

      if (value > 15000) {
        risk += 12;
      }

      risk = Math.min(risk, 98);

      const level =
        risk >= 80
          ? "Critical Fraud Risk"
          : risk >= 60
          ? "High Risk"
          : risk >= 30
          ? "Needs Review"
          : "Low Risk";

      const factors = [];

      if (value > 10000) {
        factors.push("Unusually high transaction value");
      }

      if (merchant.toLowerCase().includes("crypto")) {
        factors.push("Merchant category anomaly");
      }

      if (value > 5000) {
        factors.push("Deviation from historical spending");
      }

      factors.push("Behavioral anomaly model evaluated");
      factors.push("Device and account relationship checked");

      setAnalysis({
        risk,
        title: level,
        description:
          risk >= 60
            ? "The transaction shows multiple signals associated with suspicious behavior."
            : "No strong fraud indicators were detected from the available transaction signals.",
        factors,
      });

      setTransactions((prev) => [
        {
          id: `TXN-${92842 + prev.length}`,
          merchant: merchant || "Unknown Merchant",
          amount: value,
          location: "Real-time analysis",
          time: "Just now",
          risk,
          status:
            risk >= 80
              ? "Blocked"
              : risk >= 60
              ? "Review"
              : "Approved",
          reason: factors[0] || "Behavioral analysis completed",
        },
        ...prev,
      ]);

      setAnalyzing(false);
    }, 900);
  };

  const navItems = [
    ["Overview", "⌂"],
    ["Transactions", "↔"],
    ["Risk Intelligence", "◈"],
    ["Fraud Network", "◎"],
    ["Alerts", "⚠"],
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">F</div>

          <div>
            <strong>FinShield</strong>
            <small>Risk Intelligence</small>
          </div>
        </div>

        <div className="nav-label">COMMAND CENTER</div>

        <nav>
          {navItems.map(([item, icon]) => (
            <button
              key={item}
              className={`nav-item ${
                active === item ? "active" : ""
              }`}
              onClick={() => setActive(item)}
            >
              <span className="nav-icon">{icon}</span>

              {item}

              {item === "Alerts" && (
                <span className="alert-count">7</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="system-card">
            <div className="system-head">
              <span className="live-dot" />
              System Status
            </div>

            <strong>Protection Active</strong>

            <small>
              Real-time intelligence engine
            </small>
          </div>

          <div className="profile">
            <div className="avatar">RY</div>

            <div>
              <strong>Risk Analyst</strong>
              <small>Administrator</small>
            </div>

            <span>⋮</span>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="breadcrumb">
              FINSHIELD / {active.toUpperCase()}
            </div>

            <h1>{active}</h1>
          </div>

          <div className="top-actions">
            <div className="api-status">
              <span
                className={`status-dot ${
                  apiStatus === "Online" ? "online" : ""
                }`}
              />

              API {apiStatus}
            </div>

            <button className="icon-button">⌕</button>
            <button className="icon-button">◔</button>
          </div>
        </header>

        {active === "Overview" && (
          <>
            <section className="hero">
              <div>
                <div className="eyebrow">
                  REAL-TIME FINANCIAL DEFENSE
                </div>

                <h2>
                  Detect the <span>unknown.</span>
                  <br />
                  Stop fraud before it scales.
                </h2>

                <p>
                  FinShield combines behavioral intelligence,
                  graph analytics, device signals and adaptive
                  risk scoring to expose coordinated fraud.
                </p>
              </div>

              <div className="hero-orb">
                <div className="orb-core">AI</div>

                <div className="orb-ring ring-one" />
                <div className="orb-ring ring-two" />
              </div>
            </section>

            <section className="stats-grid">
              <StatCard
                icon="◉"
                title="Transactions Analyzed"
                value="128,492"
                change="+12.8%"
              />

              <StatCard
                icon="⚠"
                title="Fraud Prevented"
                value="₹18.4L"
                change="+8.4%"
              />

              <StatCard
                icon="◎"
                title="Average Risk Score"
                value={`${avgRisk}/100`}
                change="-6.2%"
              />

              <StatCard
                icon="✦"
                title="Detection Accuracy"
                value="96.8%"
                change="+2.1%"
              />
            </section>

            <section className="content-grid">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h3>Real-time transaction stream</h3>

                    <p>
                      Continuous behavioral risk monitoring
                    </p>
                  </div>

                  <div className="live-pill">
                    <span /> LIVE
                  </div>
                </div>

                <div className="search-row">
                  <input
                    placeholder="Search transaction, merchant or location..."
                    value={search}
                    onChange={(e) =>
                      setSearch(e.target.value)
                    }
                  />

                  <button>Filter</button>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>TRANSACTION</th>
                        <th>MERCHANT</th>
                        <th>AMOUNT</th>
                        <th>RISK</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredTransactions.map((t) => (
                        <tr key={t.id}>
                          <td>
                            <strong>{t.id}</strong>
                            <small>{t.time}</small>
                          </td>

                          <td>
                            <strong>{t.merchant}</strong>
                            <small>{t.location}</small>
                          </td>

                          <td>
                            ₹
                            {t.amount.toLocaleString(
                              "en-IN"
                            )}
                          </td>

                          <td>
                            <RiskBadge risk={t.risk} />
                          </td>

                          <td>
                            <span
                              className={`status status-${t.status.toLowerCase()}`}
                            >
                              {t.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel analysis-panel">
                <div className="panel-header">
                  <div>
                    <h3>Instant Risk Analysis</h3>
                    <p>Simulate a transaction</p>
                  </div>

                  <span className="spark">✦</span>
                </div>

                <label>Merchant</label>

                <input
                  value={merchant}
                  onChange={(e) =>
                    setMerchant(e.target.value)
                  }
                  placeholder="e.g. Nova Electronics"
                />

                <label>Transaction Amount</label>

                <div className="amount-input">
                  <span>₹</span>

                  <input
                    value={amount}
                    onChange={(e) =>
                      setAmount(e.target.value)
                    }
                    placeholder="0.00"
                    type="number"
                  />
                </div>

                <button
                  className="analyze-btn"
                  onClick={analyzeTransaction}
                  disabled={analyzing}
                >
                  {analyzing
                    ? "Analyzing signals..."
                    : "Analyze Transaction →"}
                </button>

                {analysis && (
                  <div
                    className={`analysis-result ${
                      analysis.risk >= 60
                        ? "danger-result"
                        : ""
                    }`}
                  >
                    <div className="result-score">
                      <div>
                        <small>RISK SCORE</small>

                        <strong>{analysis.risk}</strong>

                        <span>/100</span>
                      </div>

                      <div className="score-ring">
                        <div>{analysis.risk}%</div>
                      </div>
                    </div>

                    <h4>{analysis.title}</h4>

                    <p>{analysis.description}</p>

                    <div className="factor-list">
                      {analysis.factors.map((factor) => (
                        <div key={factor}>
                          <span>✓</span>
                          {factor}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="bottom-grid">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h3>Risk intelligence</h3>

                    <p>
                      Signal distribution across the network
                    </p>
                  </div>
                </div>

                <div className="risk-bars">
                  <div>
                    <span>Behavioral anomaly</span>
                    <b>82%</b>
                    <i style={{ width: "82%" }} />
                  </div>

                  <div>
                    <span>Device relationship</span>
                    <b>68%</b>
                    <i style={{ width: "68%" }} />
                  </div>

                  <div>
                    <span>Geographic anomaly</span>
                    <b>54%</b>
                    <i style={{ width: "54%" }} />
                  </div>

                  <div>
                    <span>Transaction velocity</span>
                    <b>76%</b>
                    <i style={{ width: "76%" }} />
                  </div>

                  <div>
                    <span>Merchant risk</span>
                    <b>43%</b>
                    <i style={{ width: "43%" }} />
                  </div>
                </div>
              </div>

              <div className="panel network-mini">
                <div className="panel-header">
                  <div>
                    <h3>Fraud network</h3>

                    <p>
                      Coordinated account relationships
                    </p>
                  </div>

                  <span className="network-count">
                    24 nodes
                  </span>
                </div>

                <div className="network-visual">
                  <span className="node n1" />
                  <span className="node n2" />
                  <span className="node n3" />
                  <span className="node n4" />
                  <span className="node n5" />
                  <span className="node n6" />

                  <div className="network-lines" />

                  <strong>
                    3 coordinated clusters
                  </strong>

                  <small>
                    Potential attacker-controlled accounts
                    detected
                  </small>
                </div>
              </div>
            </section>
          </>
        )}

        {active !== "Overview" && (
          <section className="panel page-placeholder">
            <div className="placeholder-icon">◈</div>

            <h2>{active}</h2>

            <p>
              {active === "Transactions"
                ? "Live transaction intelligence and risk scoring."
                : active === "Risk Intelligence"
                ? "Behavioral, device, geographic and temporal risk signals."
                : active === "Fraud Network"
                ? "Graph-based relationship analysis for coordinated fraud."
                : "Explainable alerts prioritized by risk and confidence."}
            </p>

            <button
              onClick={() => setActive("Overview")}
            >
              ← Back to Overview
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
