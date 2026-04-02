const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const GRAPHQL = "https://api.runpod.io/graphql";

async function gql(query) {
  const res = await fetch(GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RUNPOD_API_KEY}` },
    body: JSON.stringify({ query }),
  });
  return res.json();
}

// Lista todos os pods
const r = await gql(`{ myself { pods { id name desiredStatus runtime { uptimeInSeconds } } } }`);
const pods = r.data?.myself?.pods ?? [];
console.log("Pods encontrados:", pods.length);
pods.forEach(p => {
  const uptime = p.runtime?.uptimeInSeconds;
  console.log(`  ${p.id} | ${p.name} | desiredStatus: ${p.desiredStatus} | uptime: ${uptime != null ? Math.floor(uptime/60)+'min' : 'offline'}`);
});
