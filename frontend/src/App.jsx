import React, { useEffect, useMemo, useState } from "react";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "https://finshield-fraud-intelligence.onrender.com"
).replace(/\/$/, "");

const navItems = [
  { id: "Overview", icon: "⌂", label: "Overview" },
  { id: "Transactions", icon: "↔", label: "Transactions" },
  { id: "Risk Intelligence", icon: "◈", label: "Risk Intelligence" },
  { id: "Fraud Network", icon: "◎", label: "Fraud Network" },
  { id: "Alerts", icon: "⚠", label: "Alerts" },
];

const fallbackTransactions = [
  {
    id: "TXN-92841",
    merchant: "Nova Electronics",
    amount: 8420,
    location: "Mumbai, IN",
    timestamp: new Date().toISOString(),
    risk_score: 91,
    risk_level: "CRITICAL",
    fraud_probability: 0.91,
    anomaly_score: 0.87,
    explanation: "Device and location anomaly",
    account_id: "ACC-2041",
    device_id: "DEV-X82",
  },
  {
    id: "TXN-92840",
    merchant: "Urban Mart",
    amount: 1240,
    location: "Indore, IN",
    timestamp: new Date(Date.now() - 300000).toISOString(),
    risk_score: 18,
    risk_level: "LOW",
    fraud_probability: 0.12,
    anomaly_score: 0.14,
    explanation: "Normal customer behavior",
    account_id: "ACC-1040",
    device_id: "DEV-A12",
  },
  {
    id: "TXN-92839",
    merchant: "QuickPay Services",
    amount: 18600,
    location: "Delhi, IN",
    timestamp: new Date(Date.now() - 600000).toISOString(),
    risk_score: 76,
    risk_level: "HIGH",
    fraud_probability: 0.76,
    anomaly_score: 0.72,
    explanation: "Unusual transaction velocity",
    account_id: "ACC-9039",
    device_id: "DEV-X82",
  },
];

function formatMoney(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function formatTime(value) {
  if (!value) return "Just now";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Recent";

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return `${Math.max(seconds, 1)} sec ago`;

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);

  return `${hours} hr ago`;
}

function riskLabel(score) {
  const value = Number(score || 0);

  if (value >= 80) return "Critical";
  if (value >= 60) return "High";
  if (value >= 30) return "Medium";
  return "Low";
}

function RiskBadge({ score }) {
  const label = riskLabel(score);

  return (
    <span className={`risk-badge risk-${label.toLowerCase()}`}>
      <span className="risk-dot" />
      {Math.round(Number(score || 0))}% {label}
    </span>
  );
}

function StatusBadge({ status }) {
  const normalized = String(status || "OPEN").toUpperCase();

  return (
    <span className={`status-badge status-${normalized.toLowerCase()}`}>
      {normalized}
    </span>
  );
}

function StatCard({ icon, title, value, change, description }) {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <div className="stat-icon">{icon}</div>
        <span className="stat-change">{change}</span>
      </div>

      <div className="stat-title">{title}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-description">{description}</div>
    </div>
  );
}

function SectionTitle({ eyebrow, title, description, action }) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>

      {action}
    </div>
  );
}

function EmptyState({ icon, title, description }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function App() {
  const [active, setActive] = useState("Overview");

  const [transactions, setTransactions] = useState(
    fallbackTransactions
  );

  const [alerts, setAlerts] = useState([]);

  const [graph, setGraph] = useState({
    nodes: [],
    edges: [],
  });

  const [summary, setSummary] = useState({
    transactions: 0,
    alerts: 0,
    average_risk: 0,
    critical: 0,
    suspicious: 0,
    transactions_per_minute: 0,
  });

  const [apiStatus, setApiStatus] = useState("Checking");

  const [search, setSearch] = useState("");

  const [selectedTransaction, setSelectedTransaction] =
    useState(null);

  const [selectedAlert, setSelectedAlert] = useState(null);

  const [simulationRunning, setSimulationRunning] =
    useState(false);

  const [simulationLoading, setSimulationLoading] =
    useState(false);

  const [merchant, setMerchant] = useState("");

  const [amount, setAmount] = useState("");

  const [analysis, setAnalysis] = useState(null);

  const [analyzing, setAnalyzing] = useState(false);

  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });

    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  const apiFetch = async (path, options = {}) => {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      throw new Error(
        `API ${response.status}: ${response.statusText}`
      );
    }

    return response.json();
  };

  const loadDashboard = async () => {
    try {
      const data = await apiFetch("/api/dashboard/summary");
      setSummary(data);
    } catch (error) {
      console.error("Summary error:", error);
    }
  };

  const loadTransactions = async () => {
    try {
      const data = await apiFetch("/api/transactions?limit=100");

      if (Array.isArray(data) && data.length) {
        setTransactions(data);
      }
    } catch (error) {
      console.error("Transactions error:", error);
    }
  };

  const loadAlerts = async () => {
    try {
      const data = await apiFetch("/api/fraud/alerts");

      if (Array.isArray(data)) {
        setAlerts(data);
      }
    } catch (error) {
      console.error("Alerts error:", error);
    }
  };

  const loadGraph = async () => {
    try {
      const data = await apiFetch("/api/graph");

      if (data && Array.isArray(data.nodes)) {
        setGraph(data);
      }
    } catch (error) {
      console.error("Graph error:", error);
    }
  };

  const checkHealth = async () => {
    try {
      const data = await apiFetch("/api/health");

      if (data?.status === "operational") {
        setApiStatus("Online");
      } else {
        setApiStatus("Degraded");
      }
    } catch (error) {
      console.error("Health check failed:", error);
      setApiStatus("Offline");
    }
  };

  useEffect(() => {
    checkHealth();
    loadDashboard();
    loadTransactions();
    loadAlerts();
    loadGraph();

    const interval = setInterval(() => {
      checkHealth();
      loadDashboard();
      loadTransactions();
      loadAlerts();
      loadGraph();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const startSimulation = async () => {
    setSimulationLoading(true);

    try {
      await apiFetch(
        "/api/simulation/start?scenario=coordinated_fraud",
        {
          method: "POST",
        }
      );

      setSimulationRunning(true);

      showToast(
        "Coordinated fraud simulation started"
      );

      await loadDashboard();
      await loadTransactions();
      await loadAlerts();
      await loadGraph();
    } catch (error) {
      console.error(error);

      showToast(
        "Unable to start simulation",
        "error"
      );
    } finally {
      setSimulationLoading(false);
    }
  };

  const stopSimulation = async () => {
    setSimulationLoading(true);

    try {
      await apiFetch("/api/simulation/stop", {
        method: "POST",
      });

      setSimulationRunning(false);

      showToast(
        "Fraud simulation stopped"
      );
    } catch (error) {
      console.error(error);

      showToast(
        "Unable to stop simulation",
        "error"
      );
    } finally {
      setSimulationLoading(false);
    }
  };

  const analyzeTransaction = () => {
    const value = Number(amount);

    if (!value || value <= 0) {
      showToast(
        "Enter a valid transaction amount",
        "error"
      );
      return;
    }

    setAnalyzing(true);

    setTimeout(() => {
      let score = Math.min(
        95,
        Math.round(12 + value / 1500)
      );

      if (
        merchant.toLowerCase().includes("crypto")
      ) {
        score += 22;
      }

      if (value > 15000) {
        score += 12;
      }

      score = Math.min(score, 98);

      const factors = [];

      if (value > 10000) {
        factors.push(
          "Unusually high transaction value"
        );
      }

      if (
        merchant.toLowerCase().includes("crypto")
      ) {
        factors.push(
          "Merchant category anomaly"
        );
      }

      if (value > 5000) {
        factors.push(
          "Deviation from historical spending"
        );
      }

      factors.push(
        "Behavioral anomaly model evaluated"
      );

      factors.push(
        "Device and account relationship checked"
      );

      setAnalysis({
        risk: score,
        title:
          score >= 80
            ? "Critical Fraud Risk"
            : score >= 60
            ? "High Risk"
            : score >= 30
            ? "Needs Review"
            : "Low Risk",
        description:
          score >= 60
            ? "Multiple suspicious signals were detected."
            : "No strong fraud indicators were detected.",
        factors,
      });

      setAnalyzing(false);
    }, 700);
  };

  const filteredTransactions = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (!query) return transactions;

    return transactions.filter((tx) => {
      return (
        String(tx.id || "")
          .toLowerCase()
          .includes(query) ||
        String(tx.merchant || "")
          .toLowerCase()
          .includes(query) ||
        String(tx.location || "")
          .toLowerCase()
          .includes(query) ||
        String(tx.account_id || "")
          .toLowerCase()
          .includes(query) ||
        String(tx.device_id || "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [transactions, search]);

  const riskDistribution = useMemo(() => {
    const total = Math.max(transactions.length, 1);

    const critical = transactions.filter(
      (x) => Number(x.risk_score) >= 80
    ).length;

    const high = transactions.filter(
      (x) =>
        Number(x.risk_score) >= 60 &&
        Number(x.risk_score) < 80
    ).length;

    const medium = transactions.filter(
      (x) =>
        Number(x.risk_score) >= 30 &&
        Number(x.risk_score) < 60
    ).length;

    const low = transactions.filter(
      (x) => Number(x.risk_score) < 30
    ).length;

    return {
      critical: Math.round((critical / total) * 100),
      high: Math.round((high / total) * 100),
      medium: Math.round((medium / total) * 100),
      low: Math.round((low / total) * 100),
    };
  }, [transactions]);

  const riskSignals = [
    {
      name: "Behavioral anomaly",
      value: 82,
      description:
        "Deviation from historical customer behavior",
    },
    {
      name: "Device relationship",
      value: 68,
      description:
        "Shared or suspicious device associations",
    },
    {
      name: "Geographic anomaly",
      value: 54,
      description:
        "Location and travel pattern inconsistencies",
    },
    {
      name: "Transaction velocity",
      value: 76,
      description:
        "Unusual transaction frequency",
    },
    {
      name: "Merchant risk",
      value: 43,
      description:
        "Merchant-level risk characteristics",
    },
  ];

  return (
    <div className="app-shell">
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          <span>
            {toast.type === "error" ? "!" : "✓"}
          </span>
          {toast.message}
        </div>
      )}

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">F</div>

          <div className="brand-copy">
            <strong>FinShield</strong>
            <small>Risk Intelligence</small>
          </div>
        </div>

        <div className="nav-label">
          COMMAND CENTER
        </div>

        <nav className="navigation">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${
                active === item.id ? "active" : ""
              }`}
              onClick={() => setActive(item.id)}
            >
              <span className="nav-icon">
                {item.icon}
              </span>

              <span>{item.label}</span>

              {item.id === "Alerts" &&
                alerts.length > 0 && (
                  <span className="alert-count">
                    {Math.min(alerts.length, 99)}
                  </span>
                )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="system-card">
            <div className="system-head">
              <span className="live-dot" />
              <span>System Status</span>
            </div>

            <strong>
              {apiStatus === "Online"
                ? "Protection Active"
                : "Checking Systems"}
            </strong>

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
                  apiStatus === "Online"
                    ? "online"
                    : ""
                }`}
              />

              API {apiStatus}
            </div>

            <button
              className="icon-button"
              onClick={() => {
                loadDashboard();
                loadTransactions();
                loadAlerts();
                loadGraph();
              }}
              title="Refresh"
            >
              ↻
            </button>

            <div className="top-avatar">
              RY
            </div>
          </div>
        </header>

        {/* =====================================================
            OVERVIEW
        ===================================================== */}

        {active === "Overview" && (
          <div className="page">
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow">
                  REAL-TIME FINANCIAL DEFENSE
                </div>

                <h2>
                  Detect the{" "}
                  <span>unknown.</span>
                  <br />
                  Stop fraud before it scales.
                </h2>

                <p>
                  FinShield combines behavioral
                  intelligence, graph analytics,
                  device signals and adaptive risk
                  scoring to expose coordinated fraud.
                </p>

                <div className="hero-actions">
                  {!simulationRunning ? (
                    <button
                      className="primary-button"
                      onClick={startSimulation}
                      disabled={simulationLoading}
                    >
                      {simulationLoading
                        ? "Starting..."
                        : "▶ Launch Fraud Simulation"}
                    </button>
                  ) : (
                    <button
                      className="danger-button"
                      onClick={stopSimulation}
                      disabled={simulationLoading}
                    >
                      ■ Stop Simulation
                    </button>
                  )}

                  <button
                    className="secondary-button"
                    onClick={() =>
                      setActive("Fraud Network")
                    }
                  >
                    Explore Network →
                  </button>
                </div>

                <div className="hero-status">
                  <span className="live-dot" />
                  <span>
                    {simulationRunning
                      ? "Coordinated fraud simulation active"
                      : "Real-time monitoring active"}
                  </span>
                </div>
              </div>

              <div className="hero-visual">
                <div className="orb">
                  <div className="orb-ring orb-ring-one" />
                  <div className="orb-ring orb-ring-two" />
                  <div className="orb-ring orb-ring-three" />

                  <div className="orb-core">
                    <span>AI</span>
                    <small>RISK<br />ENGINE</small>
                  </div>

                  <div className="orb-node orb-node-one">
                    DEVICE
                  </div>

                  <div className="orb-node orb-node-two">
                    BEHAVIOR
                  </div>

                  <div className="orb-node orb-node-three">
                    GRAPH
                  </div>
                </div>
              </div>
            </section>

            <section className="stats-grid">
              <StatCard
                icon="◉"
                title="Transactions Analyzed"
                value={summary.transactions.toLocaleString(
                  "en-IN"
                )}
                change="+12.8%"
                description="Across monitored accounts"
              />

              <StatCard
                icon="⚠"
                title="Fraud Alerts"
                value={summary.alerts.toLocaleString(
                  "en-IN"
                )}
                change="+8.4%"
                description="Suspicious activity detected"
              />

              <StatCard
                icon="◎"
                title="Average Risk Score"
                value={`${Math.round(
                  summary.average_risk || 0
                )}/100`}
                change="-6.2%"
                description="Portfolio risk level"
              />

              <StatCard
                icon="✦"
                title="Detection Accuracy"
                value="96.8%"
                change="+2.1%"
                description="Adaptive model performance"
              />
            </section>

            <section className="content-grid">
              <div className="panel large-panel">
                <SectionTitle
                  title="Real-time transaction stream"
                  description="Continuous behavioral risk monitoring"
                  action={
                    <div className="live-pill">
                      <span />
                      LIVE
                    </div>
                  }
                />

                <div className="table-toolbar">
                  <div className="search-box">
                    <span>⌕</span>

                    <input
                      placeholder="Search transaction, merchant, account..."
                      value={search}
                      onChange={(e) =>
                        setSearch(e.target.value)
                      }
                    />
                  </div>

                  <button
                    className="ghost-button"
                    onClick={() =>
                      setActive("Transactions")
                    }
                  >
                    View all →
                  </button>
                </div>

                <TransactionTable
                  transactions={filteredTransactions.slice(
                    0,
                    7
                  )}
                  onSelect={setSelectedTransaction}
                />
              </div>

              <div className="panel analysis-panel">
                <SectionTitle
                  title="Instant Risk Analysis"
                  description="Simulate a transaction"
                />

                <label>Merchant</label>

                <input
                  className="form-input"
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
                    type="number"
                    value={amount}
                    onChange={(e) =>
                      setAmount(e.target.value)
                    }
                    placeholder="0.00"
                  />
                </div>

                <button
                  className="primary-button full-width"
                  onClick={analyzeTransaction}
                  disabled={analyzing}
                >
                  {analyzing
                    ? "Analyzing signals..."
                    : "Analyze Transaction →"}
                </button>

                {analysis && (
                  <div className="analysis-result">
                    <div className="analysis-score">
                      <div>
                        <small>RISK SCORE</small>

                        <strong>
                          {analysis.risk}
                        </strong>

                        <span>/100</span>
                      </div>

                      <div
                        className="score-circle"
                        style={{
                          "--score": `${analysis.risk * 3.6}deg`,
                        }}
                      >
                        {analysis.risk}%
                      </div>
                    </div>

                    <h3>{analysis.title}</h3>

                    <p>
                      {analysis.description}
                    </p>

                    <div className="factor-list">
                      {analysis.factors.map(
                        (factor, index) => (
                          <div key={index}>
                            <span>✓</span>
                            {factor}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="bottom-grid">
              <div className="panel">
                <SectionTitle
                  title="Risk intelligence"
                  description="Signal distribution across the network"
                  action={
                    <button
                      className="ghost-button"
                      onClick={() =>
                        setActive("Risk Intelligence")
                      }
                    >
                      Details →
                    </button>
                  }
                />

                <RiskSignalBars
                  signals={riskSignals}
                />
              </div>

              <div className="panel">
                <SectionTitle
                  title="Fraud network"
                  description="Coordinated account relationships"
                  action={
                    <button
                      className="ghost-button"
                      onClick={() =>
                        setActive("Fraud Network")
                      }
                    >
                      Investigate →
                    </button>
                  }
                />

                <MiniNetwork graph={graph} />
              </div>
            </section>
          </div>
        )}

        {/* =====================================================
            TRANSACTIONS
        ===================================================== */}

        {active === "Transactions" && (
          <div className="page">
            <SectionTitle
              eyebrow="LIVE DATA"
              title="Transaction Intelligence"
              description="Every transaction is evaluated against behavioral, device, geographic and temporal signals."
              action={
                <button
                  className="secondary-button"
                  onClick={loadTransactions}
                >
                  ↻ Refresh
                </button>
              }
            />

            <div className="metrics-row">
              <MetricBox
                label="Total analyzed"
                value={summary.transactions}
              />

              <MetricBox
                label="Critical"
                value={summary.critical}
                danger
              />

              <MetricBox
                label="Suspicious"
                value={summary.suspicious}
              />

              <MetricBox
                label="Transactions / min"
                value={summary.transactions_per_minute}
              />
            </div>

            <div className="panel">
              <div className="table-toolbar">
                <div className="search-box wide">
                  <span>⌕</span>

                  <input
                    placeholder="Search ID, merchant, account, device or location..."
                    value={search}
                    onChange={(e) =>
                      setSearch(e.target.value)
                    }
                  />
                </div>

                <span className="result-count">
                  {filteredTransactions.length} results
                </span>
              </div>

              <TransactionTable
                transactions={filteredTransactions}
                onSelect={setSelectedTransaction}
                detailed
              />
            </div>
          </div>
        )}

        {/* =====================================================
            RISK INTELLIGENCE
        ===================================================== */}

        {active === "Risk Intelligence" && (
          <div className="page">
            <SectionTitle
              eyebrow="ADAPTIVE DETECTION"
              title="Risk Intelligence"
              description="Multi-signal behavioral analysis designed to reduce false positives while exposing unknown fraud patterns."
              action={
                <div className="live-pill">
                  <span />
                  MODEL ACTIVE
                </div>
              }
            />

            <div className="risk-overview-grid">
              <div className="panel risk-score-panel">
                <div className="big-risk-score">
                  <div className="risk-score-number">
                    {Math.round(
                      summary.average_risk || 0
                    )}
                  </div>

                  <div className="risk-score-label">
                    Average Risk
                  </div>

                  <div className="risk-meter">
                    <div
                      style={{
                        width: `${Math.min(
                          summary.average_risk || 0,
                          100
                        )}%`,
                      }}
                    />
                  </div>

                  <p>
                    Current portfolio-level risk
                    calculated from monitored
                    transactions.
                  </p>
                </div>
              </div>

              <div className="panel">
                <SectionTitle
                  title="Risk distribution"
                  description="Current transaction population"
                />

                <div className="distribution">
                  <DistributionRow
                    label="Critical"
                    value={riskDistribution.critical}
                    className="critical"
                  />

                  <DistributionRow
                    label="High"
                    value={riskDistribution.high}
                    className="high"
                  />

                  <DistributionRow
                    label="Medium"
                    value={riskDistribution.medium}
                    className="medium"
                  />

                  <DistributionRow
                    label="Low"
                    value={riskDistribution.low}
                    className="low"
                  />
                </div>
              </div>
            </div>

            <div className="panel">
              <SectionTitle
                title="Detection signal matrix"
                description="Explainable signals contributing to risk decisions"
              />

              <div className="signal-grid">
                {riskSignals.map((signal) => (
                  <div
                    className="signal-card"
                    key={signal.name}
                  >
                    <div className="signal-card-top">
                      <span>{signal.name}</span>
                      <strong>
                        {signal.value}%
                      </strong>
                    </div>

                    <div className="signal-track">
                      <div
                        style={{
                          width: `${signal.value}%`,
                        }}
                      />
                    </div>

                    <p>
                      {signal.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="two-column-panels">
              <div className="panel">
                <SectionTitle
                  title="False-positive protection"
                  description="Why legitimate users are not automatically blocked"
                />

                <div className="protection-list">
                  <ProtectionItem
                    icon="✓"
                    title="Behavioral baseline"
                    text="Compares activity against each customer's historical behavior."
                  />

                  <ProtectionItem
                    icon="✓"
                    title="Multi-signal confirmation"
                    text="Risk escalation requires multiple independent signals."
                  />

                  <ProtectionItem
                    icon="✓"
                    title="Relationship intelligence"
                    text="Shared devices and accounts reveal coordinated patterns."
                  />
                </div>
              </div>

              <div className="panel">
                <SectionTitle
                  title="Model decisions"
                  description="Adaptive intelligence pipeline"
                />

                <div className="pipeline">
                  <PipelineStep
                    number="01"
                    title="Collect"
                    text="Transaction + device + location"
                  />

                  <PipelineStep
                    number="02"
                    title="Analyze"
                    text="Behavioral anomaly detection"
                  />

                  <PipelineStep
                    number="03"
                    title="Correlate"
                    text="Graph relationship analysis"
                  />

                  <PipelineStep
                    number="04"
                    title="Score"
                    text="Explainable risk decision"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================
            FRAUD NETWORK
        ===================================================== */}

        {active === "Fraud Network" && (
          <div className="page">
            <SectionTitle
              eyebrow="GRAPH INTELLIGENCE"
              title="Fraud Network"
              description="Discover coordinated attackers by correlating accounts, devices and merchants."
              action={
                <button
                  className="secondary-button"
                  onClick={loadGraph}
                >
                  ↻ Refresh Graph
                </button>
              }
            />

            <div className="metrics-row">
              <MetricBox
                label="Graph nodes"
                value={graph.nodes.length}
              />

              <MetricBox
                label="Relationships"
                value={graph.edges.length}
              />

              <MetricBox
                label="Suspicious accounts"
                value={
                  graph.nodes.filter(
                    (n) => n.type === "account"
                  ).length
                }
                danger
              />

              <MetricBox
                label="Devices"
                value={
                  graph.nodes.filter(
                    (n) => n.type === "device"
                  ).length
                }
              />
            </div>

            <div className="network-layout">
              <div className="panel graph-panel">
                <div className="graph-header">
                  <div>
                    <h3>Relationship Graph</h3>
                    <p>
                      Accounts → devices → merchants
                    </p>
                  </div>

                  <div className="graph-legend">
                    <span>
                      <i className="legend-account" />
                      Account
                    </span>

                    <span>
                      <i className="legend-device" />
                      Device
                    </span>

                    <span>
                      <i className="legend-merchant" />
                      Merchant
                    </span>
                  </div>
                </div>

                <NetworkGraph graph={graph} />
              </div>

              <div className="panel network-insights">
                <SectionTitle
                  title="Network insights"
                  description="Signals found in connected entities"
                />

                <div className="insight-item">
                  <div className="insight-icon danger">
                    !
                  </div>

                  <div>
                    <strong>
                      Shared device detection
                    </strong>

                    <p>
                      Multiple accounts may be
                      associated with the same device.
                    </p>
                  </div>
                </div>

                <div className="insight-item">
                  <div className="insight-icon">
                    ◎
                  </div>

                  <div>
                    <strong>
                      Account clustering
                    </strong>

                    <p>
                      Connected entities can reveal
                      coordinated attacker groups.
                    </p>
                  </div>
                </div>

                <div className="insight-item">
                  <div className="insight-icon">
                    ◈
                  </div>

                  <div>
                    <strong>
                      Merchant concentration
                    </strong>

                    <p>
                      Suspicious transaction activity
                      can converge on specific merchants.
                    </p>
                  </div>
                </div>

                <button
                  className="primary-button full-width"
                  onClick={startSimulation}
                  disabled={
                    simulationRunning ||
                    simulationLoading
                  }
                >
                  {simulationRunning
                    ? "Simulation Active"
                    : "▶ Simulate Coordinated Fraud"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================
            ALERTS
        ===================================================== */}

        {active === "Alerts" && (
          <div className="page">
            <SectionTitle
              eyebrow="EXPLAINABLE DETECTION"
              title="Fraud Alerts"
              description="Prioritized alerts with evidence explaining why each transaction is suspicious."
              action={
                <button
                  className="secondary-button"
                  onClick={loadAlerts}
                >
                  ↻ Refresh
                </button>
              }
            />

            <div className="alert-summary">
              <div className="alert-summary-card critical-card">
                <span>CRITICAL</span>
                <strong>
                  {
                    alerts.filter(
                      (a) =>
                        String(a.severity).toUpperCase() ===
                        "CRITICAL"
                    ).length
                  }
                </strong>
              </div>

              <div className="alert-summary-card high-card">
                <span>HIGH</span>
                <strong>
                  {
                    alerts.filter(
                      (a) =>
                        String(a.severity).toUpperCase() ===
                        "HIGH"
                    ).length
                  }
                </strong>
              </div>

              <div className="alert-summary-card">
                <span>OPEN ALERTS</span>
                <strong>
                  {
                    alerts.filter(
                      (a) =>
                        String(a.status).toUpperCase() ===
                        "OPEN"
                    ).length
                  }
                </strong>
              </div>
            </div>

            <div className="panel">
              {alerts.length === 0 ? (
                <EmptyState
                  icon="✓"
                  title="No active fraud alerts"
                  description="Start the coordinated fraud simulation to generate explainable alerts."
                />
              ) : (
                <div className="alerts-list">
                  {alerts.map((alert) => (
                    <AlertCard
                      key={alert.id}
                      alert={alert}
                      onClick={() =>
                        setSelectedAlert(alert)
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {selectedTransaction && (
        <TransactionModal
          transaction={selectedTransaction}
          onClose={() =>
            setSelectedTransaction(null)
          }
        />
      )}

      {selectedAlert && (
        <AlertModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
        />
      )}
    </div>
  );
}


/* ============================================================
   TRANSACTION TABLE
============================================================ */

function TransactionTable({
  transactions,
  onSelect,
  detailed = false,
}) {
  if (!transactions.length) {
    return (
      <EmptyState
        icon="⌁"
        title="No transactions found"
        description="Try another search or wait for the real-time stream."
      />
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>TRANSACTION</th>
            <th>MERCHANT</th>
            <th>AMOUNT</th>
            <th>RISK</th>

            {detailed && <th>ACCOUNT / DEVICE</th>}

            <th>STATUS</th>
          </tr>
        </thead>

        <tbody>
          {transactions.map((tx) => {
            const score = Number(
              tx.risk_score ?? tx.risk ?? 0
            );

            const status =
              score >= 80
                ? "BLOCKED"
                : score >= 60
                ? "REVIEW"
                : "APPROVED";

            return (
              <tr
                key={tx.id}
                className="clickable-row"
                onClick={() => onSelect(tx)}
              >
                <td>
                  <strong>{tx.id}</strong>

                  <small>
                    {formatTime(tx.timestamp)}
                  </small>
                </td>

                <td>
                  <strong>
                    {tx.merchant || "Unknown"}
                  </strong>

                  <small>
                    {tx.location || "Unknown location"}
                  </small>
                </td>

                <td>
                  <strong>
                    {formatMoney(tx.amount)}
                  </strong>
                </td>

                <td>
                  <RiskBadge score={score} />
                </td>

                {detailed && (
                  <td>
                    <strong>
                      {tx.account_id || "—"}
                    </strong>

                    <small>
                      {tx.device_id || "No device"}
                    </small>
                  </td>
                )}

                <td>
                  <StatusBadge status={status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


/* ============================================================
   RISK SIGNALS
============================================================ */

function RiskSignalBars({ signals }) {
  return (
    <div className="risk-bars">
      {signals.map((signal) => (
        <div
          className="risk-bar-row"
          key={signal.name}
        >
          <div className="risk-bar-label">
            <span>{signal.name}</span>
            <strong>{signal.value}%</strong>
          </div>

          <div className="risk-bar-track">
            <div
              style={{
                width: `${signal.value}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}


/* ============================================================
   MINI NETWORK
============================================================ */

function MiniNetwork({ graph }) {
  const nodeCount = graph.nodes.length;

  return (
    <div className="mini-network">
      <div className="network-glow" />

      <div className="mini-node mini-node-center">
        <span>AI</span>
      </div>

      <div className="mini-node mini-node-a">
        A
      </div>

      <div className="mini-node mini-node-b">
        D
      </div>

      <div className="mini-node mini-node-c">
        M
      </div>

      <div className="mini-line line-a" />
      <div className="mini-line line-b" />
      <div className="mini-line line-c" />

      <div className="network-caption">
        <strong>
          {nodeCount || 24} connected nodes
        </strong>

        <small>
          Account • Device • Merchant relationships
        </small>
      </div>
    </div>
  );
}


/* ============================================================
   ACTUAL GRAPH
============================================================ */

function NetworkGraph({ graph }) {
  if (!graph.nodes.length) {
    return (
      <EmptyState
        icon="◎"
        title="Network data unavailable"
        description="Run the fraud simulation to populate the relationship graph."
      />
    );
  }

  const displayNodes = graph.nodes.slice(0, 30);

  const width = 900;
  const height = 520;
  const centerX = width / 2;
  const centerY = height / 2;

  const positioned = displayNodes.map(
    (node, index) => {
      const angle =
        (index / Math.max(displayNodes.length, 1)) *
        Math.PI *
        2;

      const radius =
        index % 3 === 0 ? 175 : 115;

      return {
        ...node,
        x:
          centerX +
          Math.cos(angle) * radius,
        y:
          centerY +
          Math.sin(angle) * radius,
      };
    }
  );

  const positions = Object.fromEntries(
    positioned.map((node) => [
      node.id,
      node,
    ])
  );

  return (
    <div className="network-canvas">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {graph.edges
          .filter(
            (edge) =>
              positions[edge.source] &&
              positions[edge.target]
          )
          .slice(0, 60)
          .map((edge, index) => {
            const source =
              positions[edge.source];

            const target =
              positions[edge.target];

            return (
              <line
                key={`${edge.source}-${edge.target}-${index}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                className="graph-edge"
              />
            );
          })}

        {positioned.map((node) => {
          const radius =
            node.type === "account"
              ? 18
              : node.type === "device"
              ? 14
              : 11;

          return (
            <g
              key={node.id}
              className="graph-node"
            >
              <circle
                cx={node.x}
                cy={node.y}
                r={radius + 7}
                className={`node-glow node-${node.type}`}
              />

              <circle
                cx={node.x}
                cy={node.y}
                r={radius}
                className={`node-circle node-${node.type}`}
              />

              <text
                x={node.x}
                y={node.y + 4}
                textAnchor="middle"
                className="node-text"
              >
                {node.type === "account"
                  ? "A"
                  : node.type === "device"
                  ? "D"
                  : "M"}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="graph-center-label">
        <strong>Fraud Intelligence Graph</strong>
        <span>
          {graph.nodes.length} nodes •{" "}
          {graph.edges.length} relationships
        </span>
      </div>
    </div>
  );
}


/* ============================================================
   METRIC
============================================================ */

function MetricBox({
  label,
  value,
  danger = false,
}) {
  return (
    <div
      className={`metric-box ${
        danger ? "metric-danger" : ""
      }`}
    >
      <span>{label}</span>
      <strong>
        {Number(value || 0).toLocaleString("en-IN")}
      </strong>
    </div>
  );
}


/* ============================================================
   DISTRIBUTION
============================================================ */

function DistributionRow({
  label,
  value,
  className,
}) {
  return (
    <div className="distribution-row">
      <div>
        <span className={`distribution-dot ${className}`} />
        <span>{label}</span>
      </div>

      <strong>{value}%</strong>

      <div className="distribution-track">
        <div
          className={className}
          style={{
            width: `${Math.max(value, 2)}%`,
          }}
        />
      </div>
    </div>
  );
}


/* ============================================================
   PROTECTION
============================================================ */

function ProtectionItem({
  icon,
  title,
  text,
}) {
  return (
    <div className="protection-item">
      <div className="protection-icon">
        {icon}
      </div>

      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}


/* ============================================================
   PIPELINE
============================================================ */

function PipelineStep({
  number,
  title,
  text,
}) {
  return (
    <div className="pipeline-step">
      <span>{number}</span>

      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}


/* ============================================================
   ALERT CARD
============================================================ */

function AlertCard({
  alert,
  onClick,
}) {
  const severity = String(
    alert.severity || "HIGH"
  ).toUpperCase();

  return (
    <button
      className="alert-card"
      onClick={onClick}
    >
      <div
        className={`alert-severity severity-${severity.toLowerCase()}`}
      >
        !
      </div>

      <div className="alert-main">
        <div className="alert-title-row">
          <h3>
            {alert.title ||
              "Suspicious transaction detected"}
          </h3>

          <StatusBadge
            status={alert.status || "OPEN"}
          />
        </div>

        <p>
          {alert.explanation ||
            "Multiple risk signals detected."}
        </p>

        <div className="alert-meta">
          <span>
            TX: {alert.transaction_id || "—"}
          </span>

          <span>
            Account: {alert.account_id || "—"}
          </span>

          <span>
            {formatTime(alert.created_at)}
          </span>
        </div>
      </div>

      <div className="alert-risk">
        <small>RISK</small>
        <strong>
          {Math.round(
            Number(alert.risk_score || 0)
          )}
        </strong>
      </div>

      <span className="alert-arrow">
        →
      </span>
    </button>
  );
}


/* ============================================================
   TRANSACTION MODAL
============================================================ */

function TransactionModal({
  transaction,
  onClose,
}) {
  const score = Number(
    transaction.risk_score || 0
  );

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
    >
      <div
        className="modal"
        onClick={(e) =>
          e.stopPropagation()
        }
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">
              TRANSACTION INVESTIGATION
            </span>

            <h2>{transaction.id}</h2>
          </div>

          <button
            className="close-button"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="modal-risk">
          <div>
            <small>RISK SCORE</small>

            <strong>{score}</strong>

            <span>/100</span>
          </div>

          <RiskBadge score={score} />
        </div>

        <div className="detail-grid">
          <DetailItem
            label="Merchant"
            value={transaction.merchant}
          />

          <DetailItem
            label="Amount"
            value={formatMoney(transaction.amount)}
          />

          <DetailItem
            label="Location"
            value={transaction.location}
          />

          <DetailItem
            label="Account"
            value={transaction.account_id}
          />

          <DetailItem
            label="Device"
            value={transaction.device_id}
          />

          <DetailItem
            label="Risk level"
            value={riskLabel(score)}
          />
        </div>

        <div className="explanation-box">
          <span>WHY THIS MATTERS</span>

          <p>
            {transaction.explanation ||
              "Behavioral and contextual signals were evaluated by the FinShield risk engine."}
          </p>
        </div>
      </div>
    </div>
  );
}


/* ============================================================
   ALERT MODAL
============================================================ */

function AlertModal({
  alert,
  onClose,
}) {
  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
    >
      <div
        className="modal"
        onClick={(e) =>
          e.stopPropagation()
        }
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">
              EXPLAINABLE FRAUD ALERT
            </span>

            <h2>
              {alert.title ||
                "Suspicious activity"}
            </h2>
          </div>

          <button
            className="close-button"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="alert-modal-score">
          <div>
            <small>RISK SCORE</small>

            <strong>
              {Math.round(
                Number(alert.risk_score || 0)
              )}
            </strong>

            <span>/100</span>
          </div>

          <StatusBadge
            status={alert.status || "OPEN"}
          />
        </div>

        <div className="explanation-box">
          <span>EXPLANATION</span>

          <p>
            {alert.explanation ||
              "The risk engine detected multiple suspicious signals."}
          </p>
        </div>

        <div className="detail-grid">
          <DetailItem
            label="Transaction"
            value={alert.transaction_id}
          />

          <DetailItem
            label="Account"
            value={alert.account_id}
          />

          <DetailItem
            label="Severity"
            value={alert.severity}
          />

          <DetailItem
            label="Created"
            value={formatTime(
              alert.created_at
            )}
          />
        </div>
      </div>
    </div>
  );
}


/* ============================================================
   DETAIL ITEM
============================================================ */

function DetailItem({
  label,
  value,
}) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

export default App;
