import "server-only";
export type ProjectDomain = { name: string; apexName?: string; verified?: boolean; redirect?: string | null; gitBranch?: string | null; customEnvironmentId?: string | null; verification?: Array<{type: string; domain: string; value: string; reason?: string}> };
export type DomainConfig = { misconfigured?: boolean; recommendedCNAME?: Array<{rank: number; value: string}>; recommendedIPv4?: Array<{rank: number; value: string[]}> };
export function domainServiceConfigured() { return Boolean(process.env.VERCEL_DOMAIN_TOKEN && process.env.VERCEL_DOMAIN_PROJECT_ID); }
export function projectDomainPath(host?: string) {
  const project = process.env.VERCEL_DOMAIN_PROJECT_ID;
  if (!project) throw new Error("서버에 VERCEL_DOMAIN_PROJECT_ID를 설정하세요.");
  return `/v9/projects/${encodeURIComponent(project)}/domains${host ? `/${encodeURIComponent(host)}` : ""}`;
}
export async function vercelRequest<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const token = process.env.VERCEL_DOMAIN_TOKEN;
  if (!token) throw new Error("서버에 VERCEL_DOMAIN_TOKEN을 설정하세요.");
  const url = new URL(path, "https://api.vercel.com");
  if (process.env.VERCEL_DOMAIN_TEAM_ID) url.searchParams.set("teamId", process.env.VERCEL_DOMAIN_TEAM_ID);
  const response = await fetch(url, { method, cache: "no-store", signal: AbortSignal.timeout(12000), headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"}, ...(body ? {body: JSON.stringify(body)} : {}) });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(String(data.error?.message || `Vercel 요청 실패 (${response.status})`)) as Error & { status: number };
    error.status = response.status;
    throw error;
  }
  return data as T;
}
export async function ensureProjectDomain(host: string) {
  try { return await vercelRequest<ProjectDomain>(projectDomainPath(host)); }
  catch (error) {
    if ((error as {status?: number}).status !== 404) throw error;
    return vercelRequest<ProjectDomain>(projectDomainPath().replace("/v9/", "/v10/"), "POST", {name: host});
  }
}
export type DnsRecord = {type: string; name: string; value: string};
export async function inspectOrderDomain(host: string, kind: "platform" | "custom", root: string, register: boolean) {
  const assignment = kind === "platform" ? `*.${root}` : host;
  let domain: ProjectDomain;
  try { domain = register && kind === "custom" ? await ensureProjectDomain(host) : await vercelRequest<ProjectDomain>(projectDomainPath(assignment)); }
  catch (error) {
    if (kind === "platform" && (error as {status?: number}).status === 404) throw new Error(`Vercel 프로젝트에 *.${root} 와일드카드와 DNS를 최초 한 번 설정하세요.`);
    throw error;
  }
  if (domain.redirect || domain.gitBranch || domain.customEnvironmentId) throw new Error("이 주소가 리디렉션 또는 별도 환경에 연결되어 있습니다. Vercel에서 운영 프로젝트 연결을 확인하세요.");
  if (domain.verified === false) {
    try { domain = await vercelRequest<ProjectDomain>(`${projectDomainPath(assignment)}/verify`, "POST"); }
    catch (error) { if (![400, 409].includes((error as {status?: number}).status || 0)) throw error; }
  }
  const configPath = `/v6/domains/${encodeURIComponent(host)}/config?projectIdOrName=${encodeURIComponent(process.env.VERCEL_DOMAIN_PROJECT_ID || "")}`;
  const config = await vercelRequest<DomainConfig>(configPath);
  const dns: DnsRecord[] = (domain.verification || []).map(record => ({type:record.type, name:record.domain, value:record.value}));
  const cname = [...(config.recommendedCNAME || [])].sort((a,b) => a.rank-b.rank)[0]?.value;
  const ips = [...(config.recommendedIPv4 || [])].sort((a,b) => a.rank-b.rank)[0]?.value || [];
  if (host === domain.apexName) ips.forEach(value => dns.push({type:"A",name:host,value}));
  else if (cname) dns.push({type:"CNAME",name:host,value:cname});
  return { verified: domain.verified === true && config.misconfigured === false, dns, ownershipVerified: domain.verified === true, dnsConfigured: config.misconfigured === false };
}
