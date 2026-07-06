// ==========================================
// 1. KONFIGURASI SUPABASE (SANGAT PENTING!)
// ==========================================
const supabaseUrl = 'https://vegzeednaelfozoawsmu.supabase.co'; 
const supabaseKey = 'sb_publishable_g8_gHP4xhxALN9yKUosYwQ_jYbis5S7'; 
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let mapKategori = {};
let isBalanceHidden = false;

// ==========================================
// 2. FITUR NAVIGASI & UI UTAMA
// ==========================================
function switchTab(tabId, el) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    document.getElementById('section-' + tabId).classList.add('active');
    if(el) el.classList.add('active');
}
window.switchTab = switchTab;

function toggleBalance() {
    isBalanceHidden = !isBalanceHidden;
    const balanceEl = document.getElementById('total-balance');
    const eyeIcon = document.getElementById('eye-icon');
    
    if (isBalanceHidden) {
        balanceEl.classList.add('hidden-amount');
        eyeIcon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        balanceEl.classList.remove('hidden-amount');
        eyeIcon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}
window.toggleBalance = toggleBalance;

async function updateDashboardBalance() {
    try {
        const { data: budgets } = await supabaseClient.from('budget').select('*').order('created_at', { ascending: true });
        const { data: txs } = await supabaseClient.from('transactions').select('*');

        let totalSisa = 0;
        let totalModal = 0;
        let periodeTeks = "(Belum ada periode aktif)";

        if (budgets && budgets.length > 0) {
            const latestBudget = budgets[budgets.length - 1];
            periodeTeks = `Periode: ${latestBudget.start_date} s/d ${latestBudget.end_date}`;
            
            totalModal = budgets.reduce((sum, b) => sum + parseFloat(b.amount), 0);
            let totalPakai = txs ? txs.reduce((sum, t) => sum + parseFloat(t.amount), 0) : 0;
            totalSisa = totalModal - totalPakai;
        }

        document.getElementById('total-balance').innerText = `Rp ${totalSisa.toLocaleString('id-ID')}`;
        document.getElementById('period-info').innerText = periodeTeks;
        
        const elTotal = document.getElementById('total-modal-info');
        if (elTotal) {
            elTotal.innerText = `Total Budget: Rp ${totalModal.toLocaleString('id-ID')}`;
        }
    } catch (err) {
        console.error("Gagal memuat saldo:", err.message);
    }
}
window.updateDashboardBalance = updateDashboardBalance;

function setHariIni() {
    const d = new Date();
    const tgl = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    document.getElementById('tanggal').value = tgl;
}
window.setHariIni = setHariIni;


// ==========================================
// 3. LOGIKA PRESET RENTANG TANGGAL MUTASI
// ==========================================
window.bukaRiwayatDenganShortcut = function(jenis, el) {
    const targetNav = el || document.querySelectorAll('.nav-item')[3];
    switchTab('riwayat', targetNav);
    setPresetPeriodeTanggal(jenis);
}

window.setPresetPeriodeTanggal = async function(jenis) {
    try {
        const d = new Date();
        const hariIni = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const awalBulan = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;

        if (jenis === 'hari-ini') {
            document.getElementById('filterTanggalMulai').value = hariIni;
            document.getElementById('filterTanggalAkhir').value = hariIni;
            document.getElementById('judulRiwayat').innerText = `Riwayat Harian (Hari Ini)`;
            await muatRiwayatTransaksi();
            return;
        }

        const { data: bData, error } = await supabaseClient.from('budget').select('*').order('created_at', { ascending: false });
        if (error) throw error;

        if (!bData || bData.length === 0) {
            document.getElementById('filterTanggalMulai').value = awalBulan;
            document.getElementById('filterTanggalAkhir').value = hariIni;
            document.getElementById('judulRiwayat').innerText = 'Riwayat Transaksi';
            await muatRiwayatTransaksi();
            return;
        }

        if (jenis === 'aktif') {
            const budgetAktif = bData[0]; 
            document.getElementById('filterTanggalMulai').value = budgetAktif.start_date;
            document.getElementById('filterTanggalAkhir').value = budgetAktif.end_date;
            document.getElementById('judulRiwayat').innerText = `Riwayat Periode Aktif`;
        } else if (jenis === 'sebelumnya') {
            if (bData.length < 2) {
                alert("Belum ada riwayat periode anggaran sebelum ini di database.");
                return;
            }
            const budgetLalu = bData[1]; 
            document.getElementById('filterTanggalMulai').value = budgetLalu.start_date;
            document.getElementById('filterTanggalAkhir').value = budgetLalu.end_date;
            document.getElementById('judulRiwayat').innerText = `Riwayat Periode Lalu`;
        }

        await muatRiwayatTransaksi();
    } catch (err) {
        alert("Gagal memproses rentang tanggal: " + err.message);
    }
}

async function muatRiwayatTransaksi() {
    const tabel = document.getElementById('tabelTransaksi');
    tabel.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px;">Memuat data...</td></tr>';

    const { data: allData, error } = await supabaseClient
        .from('transactions')
        .select('*')
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });

    tabel.innerHTML = '';

    if (error) {
        tabel.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--red);">Error: ${error.message}</td></tr>`;
        return;
    }

    const start = document.getElementById('filterTanggalMulai').value;
    const end = document.getElementById('filterTanggalAkhir').value;

    let filteredData = allData || [];

    if (start && end) {
        filteredData = filteredData.filter(t => {
            const tDateClean = t.transaction_date ? t.transaction_date.substring(0, 10) : '';
            return tDateClean >= start && tDateClean <= end;
        });
    }

    if (filteredData.length === 0) {
        tabel.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--red); padding: 30px 10px;">Tidak ada transaksi di rentang tanggal ini.</td></tr>`;
        return;
    }

    filteredData.forEach(t => {
        const catName = mapKategori[t.category_id] || 'Lainnya';
        const notes = t.notes ? `<br><small style="color:#666; font-weight:500;">${t.notes}</small>` : '';
        const tDateClean = t.transaction_date ? t.transaction_date.substring(0, 10) : '-';
        const dateBadge = `<br><span style="display: inline-block; background: var(--dark); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.6rem; margin-top: 4px;">📅 ${tDateClean}</span>`;

        tabel.innerHTML += `
            <tr>
                <td><b>${catName}</b>${notes}${dateBadge}</td>
                <td style="color: var(--red);">Rp ${parseFloat(t.amount).toLocaleString('id-ID')}</td>
                <td>
                    <button onclick="hapusTransaksi('${t.id}')" style="background: var(--dark); color: white; border: none; width: 30px; height: 30px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; margin: 0 auto; box-shadow: 2px 2px 0px rgba(0,0,0,0.5);">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>`;
    });
}
window.muatRiwayatTransaksi = muatRiwayatTransaksi;

async function hapusTransaksi(id) {
    if (confirm("Hapus transaksi ini?")) {
        const { error } = await supabaseClient.from('transactions').delete().eq('id', id);
        if (error) return alert("Gagal menghapus: " + error.message);
        
        await muatRiwayatTransaksi();
        await hitungSisaBudget();
        await updateDashboardBalance();
    }
}
window.hapusTransaksi = hapusTransaksi;


// ==========================================
// 4. LOGIKA SISA BUDGET PER KATEGORI
// ==========================================
async function hitungSisaBudget() {
    const catId = document.getElementById('laporanKategori').value;
    const tampilan = document.getElementById('tampilanBudget');

    if (!catId) {
        tampilan.innerHTML = "<p style='text-align:center;'>Pilih kategori di atas untuk melihat detail.</p>";
        return;
    }

    const { data: bData } = await supabaseClient.from('budget').select('*').eq('category_id', catId);
    const { data: tData } = await supabaseClient.from('transactions').select('*').eq('category_id', catId);

    if (!bData || bData.length === 0) {
        tampilan.innerHTML = "<p style='color:var(--red); font-weight:800; text-align:center;'>Belum ada budget untuk kategori ini.</p>";
        return;
    }

    const budget = bData[bData.length - 1];
    const totalBudget = parseFloat(budget.amount);
    
    const d = new Date();
    const hariIniStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const endD = new Date(budget.end_date);
    const todayD = new Date(hariIniStr);
    const sisaHariIni = Math.max(0, Math.ceil((endD.getTime() - todayD.getTime()) / (1000 * 3600 * 24)) + 1);

    let terpakaiSemua = 0, terpakaiHariIni = 0, terpakaiSebelumHariIni = 0;
    if (tData) {
        tData.forEach(t => {
            const amt = parseFloat(t.amount);
            terpakaiSemua += amt;
            if (t.transaction_date && t.transaction_date.substring(0,10) === hariIniStr) terpakaiHariIni += amt;
            else if (t.transaction_date && t.transaction_date.substring(0,10) < hariIniStr) terpakaiSebelumHariIni += amt;
        });
    }

    const sisaAnggaran = totalBudget - terpakaiSemua;
    const jatahHarian = sisaHariIni > 0 ? (totalBudget - terpakaiSebelumHariIni) / sisaHariIni : 0;
    const sisaJatahHariIni = jatahHarian - terpakaiHariIni;

    tampilan.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; padding: 5px 0; font-family: 'Space Grotesk', sans-serif;">
            <div style="text-align: center; margin-bottom: 12px;">
                <div style="font-weight: 900; font-size: 0.75rem; opacity: 0.6; letter-spacing: 1px;">SISA ANGGARAN</div>
                <div style="font-size: 1.8rem; font-weight: 900; color: ${sisaAnggaran < 0 ? 'var(--red)' : '#27ae60'};">
                    Rp ${sisaAnggaran.toLocaleString()}
                </div>
            </div>
            <div style="width: 100%; max-width: 260px; display: grid; grid-template-columns: 1fr auto; gap: 8px 15px; font-size: 0.85rem; font-weight: 700;">
                <span style="opacity: 0.6;">Total Budget</span> <span style="font-weight: 800;">Rp ${totalBudget.toLocaleString()}</span>
                <span style="opacity: 0.6;">Terpakai</span> <span style="font-weight: 800; color: var(--red);">Rp ${terpakaiSemua.toLocaleString()}</span>
                <div style="grid-column: span 2; border-top: 2px dashed var(--dark); margin: 3px 0;"></div>
                <span style="opacity: 0.6;">Jatah Harian</span> <span style="font-weight: 800; color: #2563eb;">Rp ${Math.round(jatahHarian).toLocaleString()}</span>
                <span style="opacity: 0.6;">Sisa Hari Ini</span> <span style="font-weight: 800; color: ${sisaJatahHariIni < 0 ? 'var(--red)' : '#27ae60'};">Rp ${Math.round(sisaJatahHariIni).toLocaleString()}</span>
            </div>
        </div>
    `;
}
window.hitungSisaBudget = hitungSisaBudget;


// ==========================================
// 5. PRINT PDF & EKSEKUSI HAPUS MASAL (2X CONFIRM)
// ==========================================
async function downloadPDF() {
    const catId = document.getElementById('laporanKategori').value;
    const catName = document.getElementById('laporanKategori').options[document.getElementById('laporanKategori').selectedIndex]?.text || "Kategori";
    
    if (!catId) return alert("Pilih kategori di menu Laporan terlebih dahulu untuk dicetak!");
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const { data: txs } = await supabaseClient.from('transactions').select('*').eq('category_id', catId).order('transaction_date', { ascending: true });
    
    doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text(`LAPORAN PENGELUARAN : ${catName.toUpperCase()}`, 105, 15, { align: 'center' });
    
    let y = 30; doc.setFontSize(10);
    doc.text("Tanggal", 15, y); doc.text("Nominal (Rp)", 70, y); doc.text("Catatan", 120, y);
    doc.setLineWidth(0.5); doc.line(15, y+2, 195, y+2); y += 8;
    
    doc.setFont("helvetica", "normal"); let total = 0;
    if(txs) {
        txs.forEach(t => {
            const cleanDate = t.transaction_date ? t.transaction_date.substring(0,10) : '-';
            doc.text(cleanDate, 15, y);
            doc.text(parseFloat(t.amount).toLocaleString('id-ID'), 70, y);
            doc.text((t.notes || '-').substring(0, 40), 120, y);
            total += parseFloat(t.amount); y += 7;
        });
    }
    doc.line(15, y, 195, y); y += 7; doc.setFont("helvetica", "bold");
    doc.text("TOTAL PENGELUARAN:", 70, y); doc.text(total.toLocaleString('id-ID'), 120, y);
    doc.save(`Laporan_${catName.replace(/\s+/g, '_')}.pdf`);
}
window.downloadPDF = downloadPDF;

// FUNGSI UTAMA TAB HAPUS BERKALA DENGAN INPUT KALENDER & 2X CONFIRM
async function eksekusiHapusMasal() {
    const start = document.getElementById('hapusMasalMulai').value;
    const end = document.getElementById('hapusMasalAkhir').value;

    if (!start || !end) {
        alert("Silakan pilih Tanggal Mulai dan Tanggal Akhir terlebih dahulu!");
        return;
    }

    // KONFIRMASI LAPIS 1
    if (confirm(`Anda akan menghapus DATA TRANSAKSI dari tanggal:\n${start} sampai ${end}.\n\nApakah Anda yakin?`)) {
        // KONFIRMASI LAPIS 2 (FINAL WARNING)
        if (confirm(`⚠️ PERINGATAN KERAS FINAL!\n\nData transaksi yang terhapus tidak akan bisa dikembalikan lagi.\n\nTekan OK jika Anda benar-benar yakin!`)) {
            try {
                const { error } = await supabaseClient
                    .from('transactions')
                    .delete()
                    .gte('transaction_date', start)
                    .lte('transaction_date', end);
                
                if (error) throw error;
                
                alert("🎉 Database berhasil dibersihkan untuk rentang tanggal tersebut!");
                
                // Reset kolom input kalender hapus
                document.getElementById('hapusMasalMulai').value = '';
                document.getElementById('hapusMasalAkhir').value = '';
                
                // Segarkan data dashboard dan tabel riwayat
                await updateDashboardBalance();
                await setPresetPeriodeTanggal('aktif');
                await hitungSisaBudget();
            } catch (err) {
                alert("Gagal mengosongkan database: " + err.message);
            }
        }
    }
}
window.eksekusiHapusMasal = eksekusiHapusMasal;


// ==========================================
// 6. EVENT SAMBUNGAN SUBMIT FORM KE SUPABASE
// ==========================================
async function muatKategori() {
    const { data, error } = await supabaseClient.from('categories').select('*');
    if (error) return;

    mapKategori = {};
    const dropIds = ['kategori', 'budgetKategori', 'laporanKategori', 'hapusKategoriPilihan'];
    
    dropIds.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.innerHTML = '<option value="">-- Pilih Kategori --</option>';
            data.forEach(cat => {
                mapKategori[cat.id] = cat.name;
                el.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
            });
        }
    });
}

document.getElementById('formTransaksi').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const amount = document.getElementById('amount').value;
        const tanggal = document.getElementById('tanggal').value;
        const kategori = document.getElementById('kategori').value;
        const catatan = document.getElementById('catatan').value;

        if (!kategori) return alert("Ups! Tolong pilih kategori pengeluaran dulu.");

        const { error } = await supabaseClient.from('transactions').insert([{
            amount: amount,
            transaction_date: tanggal,
            category_id: kategori,
            notes: catatan,
        }]);
        
        if (error) throw error;
        
        document.getElementById('amount').value = '';
        document.getElementById('catatan').value = '';
        
        alert("🎉 Transaksi berhasil disimpan!");
        await updateDashboardBalance();
        await setPresetPeriodeTanggal('aktif');
        await hitungSisaBudget();
    } catch (err) {
        alert("GAGAL MENYIMPAN TRANSAKSI:\n" + err.message);
    }
});

document.getElementById('formBudget').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const budgetKategori = document.getElementById('budgetKategori').value;
        if (!budgetKategori) return alert("Pilih kategori budget dulu!");

        const { error } = await supabaseClient.from('budget').insert([{
            amount: document.getElementById('budgetAmount').value,
            start_date: document.getElementById('startDate').value,
            end_date: document.getElementById('endDate').value,
            category_id: budgetKategori
        }]);
        
        if (error) throw error;
        
        document.getElementById('budgetAmount').value = '';
        alert("📈 Anggaran berhasil di-set!");
        await updateDashboardBalance();
        await hitungSisaBudget();
    } catch (err) {
        alert("GAGAL MENYIMPAN BUDGET:\n" + err.message);
    }
});

document.getElementById('formTambahKategori').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const { error } = await supabaseClient.from('categories').insert([{ name: document.getElementById('namaKategoriBaru').value }]);
        if (error) throw error;

        document.getElementById('namaKategoriBaru').value = '';
        await muatKategori();
        alert("✅ Kategori baru berhasil ditambahkan!");
    } catch (err) {
        alert("GAGAL MENAMBAH KATEGORI:\n" + err.message);
    }
});

document.getElementById('btnHapusKategori').addEventListener('click', async () => {
    try {
        const catId = document.getElementById('hapusKategoriPilihan').value;
        if (!catId) return alert("Pilih kategori yang ingin dihapus terlebih dahulu!");
        
        if (confirm("YAKIN INGIN MENGHAPUS KATEGORI INI?\nKategori akan hilang dari pilihan.")) {
            const { error } = await supabaseClient.from('categories').delete().eq('id', catId);
            if (error) throw error;
            
            await muatKategori();
            alert("🗑️ Kategori berhasil dihapus permanen!");
        }
    } catch (err) {
        alert("GAGAL MENGHAPUS KATEGORI:\n" + err.message);
    }
});


// ==========================================
// 7. MENJALANKAN SISTEM SAAT WEB DIMUAT
// ==========================================
async function inisialisasiAplikasi() {
    await muatKategori();
    await updateDashboardBalance();
    setHariIni();
    await setPresetPeriodeTanggal('aktif');
}
inisialisasiAplikasi();