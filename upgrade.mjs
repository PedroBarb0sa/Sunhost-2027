import fs from 'fs';
const pkgPath='package.json'; const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8')); pkg.scripts.dev='concurrently -k "tsx server/index.ts" "vite --host"'; pkg.scripts['dev:api']='tsx server/index.ts'; fs.writeFileSync(pkgPath, JSON.stringify(pkg,null,2)+'\n');
const serverPath='server/index.ts'; let server=fs.readFileSync(serverPath,'utf8'); server=server.replace('const port = Number(process.env.PORT || 3000);','const port = Number(process.env.PORT || (process.env.NODE_ENV === "production" ? 3000 : 3001));'); fs.writeFileSync(serverPath,server);
const vitePath='vite.config.ts'; let vite=fs.readFileSync(vitePath,'utf8'); if (!vite.includes('server: {')) vite=vite.replace('export default defineConfig({','export default defineConfig({\n  server: { proxy: { "/api": "http://localhost:3001" } },'); fs.writeFileSync(vitePath,vite);
const p='client/src/pages/Home.tsx'; let s=fs.readFileSync(p,'utf8'); s=s.replace('  password: string;\n  role:', '  password?: string;\n  role:');
s=s.replace('''    setLocalUsers(readStoredJson<LocalUser[]>("sunhost-usuarios", []));
    setSubmittedAccommodations(readStoredJson<SubmittedAccommodation[]>("sunhost-anuncios-enviados", []));
    setRemovedAccommodationIds(readStoredNumberList("sunhost-anuncios-removidos"));
    const storedSession = window.sessionStorage.getItem("sunhost-sessao");
    if (storedSession) {
      try { setCurrentUser(JSON.parse(storedSession) as LocalUser); } catch { window.sessionStorage.removeItem("sunhost-sessao"); }
    }
    setStorageReady(true);''','''    setRemovedAccommodationIds([]);
    const storedSession = window.sessionStorage.getItem("sunhost-sessao");
    if (storedSession) { try { setCurrentUser(JSON.parse(storedSession) as LocalUser); } catch { window.sessionStorage.removeItem("sunhost-sessao"); } }
    const token = window.sessionStorage.getItem("sunhost-token");
    if (token) fetch("/api/submissions", { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.ok ? response.json() : []).then(setSubmittedAccommodations).catch(() => undefined);
    setStorageReady(true);''')
s=s.replace('    window.localStorage.setItem("sunhost-usuarios", JSON.stringify(localUsers));\n    window.localStorage.setItem("sunhost-anuncios-enviados", JSON.stringify(submittedAccommodations));\n', '')
s=s.replace('  }, [civicBalance, claimedRewards, favorites, localUsers, removedAccommodationIds, storageReady, submittedAccommodations]);','  }, [civicBalance, claimedRewards, favorites, removedAccommodationIds, storageReady]);')
start=s.index('  function handleAuthSubmit('); end=s.index('\n  function logout()', start)
new='''  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = authForm.email.trim().toLowerCase();
    if (!email || !authForm.password) { setNotice("Preencha e-mail e senha para continuar."); return; }
    if (authMode === "signup" && (!authForm.name.trim() || authForm.password.length < 6)) { setNotice("Informe seu nome e use uma senha com pelo menos 6 caracteres."); return; }
    try {
      const response = await fetch(`/api/auth/${authMode === "login" ? "login" : "signup"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(authMode === "login" ? { email, password: authForm.password } : { name: authForm.name.trim(), email, password: authForm.password }) });
      const data = await response.json(); if (!response.ok) { setNotice(data.error || "Não foi possível continuar."); return; }
      setCurrentUser(data.user); window.sessionStorage.setItem("sunhost-sessao", JSON.stringify(data.user)); window.sessionStorage.setItem("sunhost-token", data.token);
      const submissions = await fetch("/api/submissions", { headers: { Authorization: `Bearer ${data.token}` } }); if (submissions.ok) setSubmittedAccommodations(await submissions.json());
      setAuthForm({ name: "", email: "", password: "" }); setPanel(data.user.role === "admin" ? "admin" : "account"); setNotice(data.user.role === "admin" ? "Painel administrativo aberto." : `Olá, ${data.user.name}. Sua conta está ativa.`);
    } catch { setNotice("Servidor indisponível. Confira o PostgreSQL e tente novamente."); }
  }
'''
s=s.slice(0,start)+new+s.slice(end)
s=s.replace('''    window.sessionStorage.removeItem("sunhost-sessao");''','''    window.sessionStorage.removeItem("sunhost-sessao"); window.sessionStorage.removeItem("sunhost-token");''')
start=s.index('  function submitAccommodation('); end=s.index('\n  function moderateAccommodation', start)
new='''  async function submitAccommodation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!currentUser || currentUser.role !== "user") return;
    if (!publishForm.title.trim() || !publishForm.district.trim() || !publishForm.price || !publishForm.description.trim()) { setNotice("Preencha título, bairro, preço e descrição para enviar o anúncio."); return; }
    try { const response = await fetch("/api/submissions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${window.sessionStorage.getItem("sunhost-token") || ""}` }, body: JSON.stringify({ ...publishForm, price: Number(publishForm.price) }) }); const data = await response.json(); if (!response.ok) { setNotice(data.error || "Não foi possível enviar."); return; } const list = await fetch("/api/submissions", { headers: { Authorization: `Bearer ${window.sessionStorage.getItem("sunhost-token") || ""}` } }); if (list.ok) setSubmittedAccommodations(await list.json()); setPublishForm({ title: "", district: "", price: "", description: "", imageUrl: "" }); setPanel("account"); setNotice("Acomodação enviada para análise do administrador."); } catch { setNotice("Servidor indisponível. Tente novamente."); }
  }
'''
s=s.slice(0,start)+new+s.slice(end)
start=s.index('  function moderateAccommodation('); end=s.index('\n  return (', start)
new='''  async function moderateAccommodation(id: number, status: "approved" | "rejected") { const token = window.sessionStorage.getItem("sunhost-token") || ""; const response = await fetch(`/api/submissions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ status }) }); if (response.ok) { setSubmittedAccommodations((current) => current.map((item) => item.id === id ? { ...item, status, moderationNote: status === "approved" ? "Aprovado para exibição." : "Rejeitado pela moderação." } : item)); setNotice(status === "approved" ? "Acomodação aprovada e publicada." : "Acomodação rejeitada."); } }

  async function removeModeratedAccommodation(id: number) { const response = await fetch(`/api/submissions/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${window.sessionStorage.getItem("sunhost-token") || ""}` } }); if (response.ok) { setSubmittedAccommodations((current) => current.filter((item) => item.id !== id)); setRemovedAccommodationIds((current) => Array.from(new Set([...current, id]))); setNotice("Acomodação removida da vitrine."); } }

  function removeModeratedPhoto(accommodationId: number, imageIndex: number) { setSubmittedAccommodations((current) => current.map((item) => item.id === accommodationId ? { ...item, images: item.images.filter((_, index) => index !== imageIndex) } : item)); setNotice("Foto removida da visualização local. Fotos enviadas devem ser revisadas no próximo envio."); }
'''
s=s.slice(0,start)+new+s.slice(end)
fs.writeFileSync(p,s);
