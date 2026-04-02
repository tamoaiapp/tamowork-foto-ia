const KEY = process.env.RUNPOD_API_KEY ?? "";
const GRAPHQL = "https://api.runpod.io/graphql";

async function gql(query) {
  const res = await fetch(GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ query }),
  });
  return res.json();
}

// Resume o pod de foto
const r = await gql(`mutation { podResume(input: { podId: "64u9u09pqlya53", gpuCount: 1 }) { id desiredStatus } }`);
console.log("Resume foto pod:", JSON.stringify(r.data ?? r.errors));

// Verifica status dos pods
await new Promise(r => setTimeout(r, 3000));
const s = await gql(`{ myself { pods { id name desiredStatus runtime { uptimeInSeconds } } } }`);
s.data?.myself?.pods?.forEach(p => {
  console.log(`  ${p.id} | ${p.name} | ${p.desiredStatus} | uptime: ${p.runtime?.uptimeInSeconds != null ? Math.floor(p.runtime.uptimeInSeconds/60)+'min' : 'offline'}`);
});
