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
        const pool = await sql.connect(config);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let insertedSchedules = [];

        const ahuResult = await pool.request().query(`
            SELECT AHUId, InstalledOn, cleaningFreqAllowance, ValidOperationLife
FROM [pereco_AssetItem] WHERE IsActive = 1
        `);

        for (const row of ahuResult.recordset) {
            const ahuId = row.AHUId;
            const installedOn = new Date(row.InstalledOn);
            const interval = row.IntervalDays;
            const validDays = row.ValidOperationLife;
            const expiryDate = new Date(installedOn.getTime() + validDays * 24 * 60 * 60 * 1000);

            // Get last scheduled date
            const lastScheduleResult = await pool.request()
                .input('AHUId', sql.Int, ahuId)
                .query(`
                    SELECT TOP 1 ScheduledDate 
                    FROM AHUCleaningSchedule 
                    WHERE AHUId = @AHUId 
                    ORDER BY ScheduledDate DESC
                `);

            let lastScheduleDate = lastScheduleResult.recordset.length > 0
                ? new Date(lastScheduleResult.recordset[0].ScheduledDate)
                : installedOn;

            const nextDueDate = new Date(lastScheduleDate.getTime() + interval * 24 * 60 * 60 * 1000);

            // Compare only date part
            if (
                nextDueDate.toDateString() === today.toDateString() &&
                nextDueDate <= expiryDate
            ) {
                // Check if already inserted
                const existsResult = await pool.request()
                    .input('AHUId', sql.Int, ahuId)
                    .input('ScheduledDate', sql.Date, nextDueDate)
                    .query(`
                        SELECT COUNT(*) AS count 
                        FROM AHUCleaningSchedule 
                        WHERE AHUId = @AHUId AND ScheduledDate = @ScheduledDate
                    `);

                if (existsResult.recordset[0].count === 0) {
                    await pool.request()
                        .input('AHUId', sql.Int, ahuId)
                        .input('ScheduledDate', sql.Date, nextDueDate)
                        .query(`
                            INSERT INTO AHUCleaningSchedule (AHUId, ScheduledDate)
                            VALUES (@AHUId, @ScheduledDate)
                        `);

                    insertedSchedules.push({
                        AHUId: ahuId,
                        ScheduledDate: nextDueDate.toISOString().slice(0, 10)
                    });
                }
            }
        }

        res.json({
            message: `${insertedSchedules.length} schedule(s) added`,
            schedules: insertedSchedules
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
