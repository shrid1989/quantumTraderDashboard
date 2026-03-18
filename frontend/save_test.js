import axios from 'axios';

const testSave = async () => {
  try {
    const payload = {
        "session_name": "Terminal Test",
        "description": "testing",
        "notes": "",
        "strategy_name": "",
        "tags": [],
        "data_date_from": "2023-01-02",
        "data_date_to": "2023-01-02",
        "total_trades": 1,
        "net_pnl": 1000,
        "win_rate": 100,
        "profit_factor": 999999,
        "max_drawdown": 0,
        "sharpe_ratio": 0,
        "expectancy": 1000,
        "risk_reward": 999999,
        "max_win_streak": 1,
        "max_loss_streak": 0,
        "trades": [
            {
                "date": "2023-01-02",
                "position": "Calls",
                "nifty_at_entry": 18000,
                "entry_reason": "Breakout",
                "entry_time": "09:15",
                "entry_price": 100,
                "exit_time": "09:30",
                "exit_price": 120,
                "exit_reason": "Target",
                "pnl_pts": 20,
                "pnl_inr": 1000,
                "trade_duration": "15",
                "pivot": 18000,
                "r1": 18100,
                "r2": 18200,
                "s1": 17900,
                "s2": 17800
            }
        ]
    };
    
    // Test hitting backend directly, simulating what frontend does
    // Normally axios would use interceptors for the token
    const token = 'test'; // Assuming test account bypassed auth locally for UI testing, we need an actual DB test here.
    
    const res = await axios.post('http://localhost:8000/api/backtest/sessions', payload, {
        // Headers here if needed
    });
    console.log("Save Response:", res.data);
    
    const listRes = await axios.get('http://localhost:8000/api/backtest/sessions');
    console.log("List Response:", listRes.data);
  } catch (err) {
    console.error("Save Error:", err.response?.data || err.message);
  }
};
testSave();
