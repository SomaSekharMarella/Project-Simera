import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import WalletConnect from "./components/WalletConnect";
import CampaignDetail from "./pages/CampaignDetail";
import CampaignList from "./pages/CampaignList";
import CreateCampaign from "./pages/CreateCampaign";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <div className="layout">
        <header className="app-header">
          <div>
            <h1>Proof of Work Crowdfunding</h1>
            <p>Decentralized campaign funding with donor governance</p>
          </div>
          <WalletConnect />
        </header>

        <nav className="app-nav">
          <Link to="/">Campaigns</Link>
          <Link to="/create">Create Campaign</Link>
        </nav>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<CampaignList />} />
            <Route path="/create" element={<CreateCampaign />} />
            <Route path="/campaign/:address" element={<CampaignDetail />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
