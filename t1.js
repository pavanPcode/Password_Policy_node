const express = require('express');
const sql = require('mssql');
const app = express();

const config = {
    user: 'RNDAdmin',
    password: '0f8$4rfT1',
    server: '132.148.105.23',
    database: 'RND_HR',
    options: {
        trustServerCertificate: true,
    }
};

app.get('/api/save-cleaning-schedule', async (req, res) => {
    try {
        await sql.connect(config);
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const inserted = [];

        const ahus = await sql.query(`
                 SELECT AHUId, InstalledOn, cleaningFreqAllowance, ValidOperationLife
FROM [pereco_AssetItem] WHERE IsActive = 1
        `);

        for (const row of ahus.recordset) {
            const ahuId = row.AHUId;
            const installedOn = new Date(row.InstalledOn);
            const interval = row.IntervalDays;
            const validDays = row.ValidOperationLife;
            const expiryDate = new Date(installedOn.getTime() + validDays * 24 * 60 * 60 * 1000);

            // Get last scheduled date
            const result = await sql.query(`
                SELECT TOP 1 ScheduledDate 
                FROM AHUCleaningSchedule 
                WHERE AHUId = '${ahuId}' 
                ORDER BY ScheduledDate DESC
            `);

            let lastScheduledDate = result.recordset.length > 0
                ? new Date(result.recordset[0].ScheduledDate)
                : installedOn;

            const nextDueDate = new Date(lastScheduledDate.getTime() + interval * 24 * 60 * 60 * 1000);
            const nextDueStr = nextDueDate.toISOString().split('T')[0];

            const scheduleExists = await sql.query(`
                SELECT COUNT(*) AS cnt 
                FROM AHUCleaningSchedule 
                WHERE AHUId = '${ahuId}' AND CAST(ScheduledDate AS DATE) = '${todayStr}'
            `);

            if (result.recordset.length === 0 && todayStr === installedOn.toISOString().split('T')[0]) {
                // First time install today
                await sql.query(`
                    INSERT INTO AHUCleaningSchedule (AHUId, ScheduledDate)
                    VALUES ('${ahuId}', '${todayStr}')
                `);
                inserted.push({ AHUId: ahuId, ScheduledDate: todayStr });
            } else if (
                nextDueStr === todayStr &&
                nextDueDate <= expiryDate &&
                scheduleExists.recordset[0].cnt === 0
            ) {
                await sql.query(`
                    INSERT INTO AHUCleaningSchedule (AHUId, ScheduledDate)
                    VALUES ('${ahuId}', '${todayStr}')
                `);
                inserted.push({ AHUId: ahuId, ScheduledDate: todayStr });
            }
        }

        res.json({
            message: `${inserted.length} schedule(s) added`,
            schedules: inserted
        });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).send('Internal server error');
    } finally {
        await sql.close();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
