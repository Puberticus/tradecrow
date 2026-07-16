const model = process.env.OPENAI_MODEL || "gpt-4.1";

const prompts = {
  chart:
    "You are Tradecrow, a trading coach focused on ICT/liquidity concepts. Analyze the chart screenshot against the trader profile. Use concise markdown sections: **What happened**, **Liquidity read**, **Execution note**, **Model lesson**, **Next time**. Do not give financial advice or certainty language.",
  setup: [
    "You are Tradecrow, a 5-minute chart analyst using ICT concepts with a strong focus on liquidity models.",
    "Read the visible screenshot first. Inspect candles, swing structure, overall 5m trend, buy-side and sell-side liquidity, liquidity sweeps, CHoCH/BOS/MSS, displacement, FVGs, breakers, and invalidation.",
    "Return a decision-support verdict, not financial advice: **LONG BIAS / BUY**, **SHORT BIAS / SELL**, or **NO-TRADE / WAIT**.",
    "Explain exactly why from the screenshot. If the screenshot is unclear, say what is unclear and choose NO-TRADE / WAIT.",
    "Use these markdown sections exactly: **Verdict**, **Confidence**, **Overall 5m trend**, **Liquidity map**, **Sweep / manipulation**, **Structure confirmation**, **Imbalance / FVG / breaker**, **Entry logic**, **Invalidation**, **Why this can fail**, **Journal lesson**. In Confidence, give 0-100 and explain what lowers confidence. In Journal lesson, connect the read to the trader profile, repeated mistakes, prior AI-read feedback, and what data to collect next."
  ].join("\n"),
  models:
    "You are Tradecrow, a model-building coach. Use the trader profile, saved trades, rules, mistakes, and base models to produce improved trading models. Each model needs: name, market condition, required confirmations, invalidation, pass condition, review question, and what data to collect next. Do not give financial advice.",
  rule:
    "You are Tradecrow, a trading rule critic. Fact-check one rule against liquidity, structure, FVGs, risk, and the trader profile. Return a verdict, where the rule works, where it fails, and a sharper rewritten version.",
  research:
    "You are Tradecrow, a trading research coach. Explain the concept with nuance, call out where it fails, and keep it practical for a liquidity trader. Use the trader profile when relevant. Do not give financial advice.",
  mindset:
    "You are Tradecrow, a mindset coach for traders. Reframe the user's thought into a more accurate read using their trader profile, recent mistakes, and evidence. Give one next action. Keep it grounded, not hype.",
  reframe:
    "You are Tradecrow, a mindset coach for traders. Reframe the user's thought into a more accurate read using their trader profile, recent mistakes, and evidence. Give one next action. Keep it grounded, not hype."
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST,OPTIONS"
    },
    body: JSON.stringify(body)
  };
}

function trimmedPayload(payload) {
  const clone = { ...payload };
  if (clone.imageDataUrl) clone.imageDataUrl = "[image attached]";
  if (clone.traderProfile?.recentTrades?.length) {
    clone.traderProfile = {
      ...clone.traderProfile,
      recentTrades: clone.traderProfile.recentTrades.slice(0, 8)
    };
  }
  return clone;
}

async function callOpenAI(task, payload) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const err = new Error("OPENAI_API_KEY is not set in Netlify environment variables.");
    err.status = 401;
    throw err;
  }

  const systemPrompt = prompts[task] || prompts.research;
  const content = [
    {
      type: "input_text",
      text: `${systemPrompt}\n\nUser context JSON:\n${JSON.stringify(trimmedPayload(payload), null, 2)}`
    }
  ];

  if (payload.imageDataUrl) {
    content.push({
      type: "input_image",
      image_url: payload.imageDataUrl,
      detail: task === "setup" || task === "chart" ? "high" : "auto"
    });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [{ role: "user", content }]
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error?.message || `OpenAI request failed with ${response.status}`);
    err.status = response.status;
    throw err;
  }

  return (
    data.output_text ||
    data.output?.flatMap(item => item.content || [])
      .filter(part => part.type === "output_text" || part.text)
      .map(part => part.text)
      .join("\n") ||
    ""
  );
}

exports.handler = async event => {
  if (event.httpMethod === "OPTIONS") return json(204, {});
  if (event.httpMethod !== "POST") return json(405, { error: "Use POST." });

  try {
    const { task = "research", payload = {} } = JSON.parse(event.body || "{}");
    const text = await callOpenAI(task, payload);
    return json(200, { text, model });
  } catch (error) {
    return json(error.status || 500, { error: error.message || "AI request failed." });
  }
};

