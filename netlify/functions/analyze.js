exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { code, language, mode } = JSON.parse(event.body);

    if (!code || !mode) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields" }) };
    }
    if (code.length > 20000) {
      return { statusCode: 400, body: JSON.stringify({ error: "Code too long. Please keep it under 20,000 characters." }) };
    }

    const validModes = ["explain", "simplify", "bugs", "optimize", "comments", "format", "minify"];
    if (!validModes.includes(mode)) {
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid mode" }) };
    }

    const l = language === "auto" ? "the detected programming language" : language;

    const prompts = {
      explain: `Explain the following ${l} code clearly and thoroughly. Describe what it does overall, then explain each important section. Use clear, simple language suitable for a learning developer.\n\nCode:\n\`\`\`\n${code}\n\`\`\``,
      simplify: `Explain the following ${l} code as if talking to a complete beginner with zero programming knowledge. Use simple everyday analogies, avoid all jargon, and make it engaging and easy to understand.\n\nCode:\n\`\`\`\n${code}\n\`\`\``,
      bugs: `Review the following ${l} code carefully for bugs, logic errors, security issues, and bad practices. List each issue clearly with line references where possible, and provide a suggested fix for each. If no issues found, say so clearly.\n\nCode:\n\`\`\`\n${code}\n\`\`\``,
      optimize: `Analyze the following ${l} code for performance, readability, and quality improvements. Provide specific suggestions with explanations and show improved code snippets where applicable.\n\nCode:\n\`\`\`\n${code}\n\`\`\``,
      comments: `Add clear, helpful inline comments to every important line or block in the following ${l} code. Return ONLY the complete code with comments added. Do not add any explanation outside the code.\n\nCode:\n\`\`\`\n${code}\n\`\`\``,
      format: `Format and prettify the following ${l} code with proper indentation, consistent spacing, and best-practice code style. Return ONLY the formatted code, nothing else — no explanation, no markdown fences.\n\nCode:\n${code}`,
      minify: `Minify the following ${l} code to make it as small as possible while keeping the exact same output and functionality. Remove all unnecessary whitespace, comments, and shorten variable names where safe. Return ONLY the minified code, nothing else — no explanation, no markdown fences.\n\nCode:\n${code}`
    };

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompts[mode] }],
        max_tokens: 4000,
        temperature: (mode === "minify" || mode === "format") ? 0.1 : 0.3
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "Groq API error");
    }

    const data = await response.json();
    let result = data.choices[0].message.content;

    // Strip markdown fences for format/minify
    if (mode === "format" || mode === "minify") {
      result = result.replace(/^```[\w]*\n?/gm, "").replace(/^```$/gm, "").trim();
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ result })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Something went wrong" })
    };
  }
};