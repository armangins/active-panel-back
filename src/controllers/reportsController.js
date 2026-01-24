const Order = require('../models/Order');

/**
 * Reports Controller
 * Handles Dashboard Analytics from Local MongoDB
 */

exports.getDashboardSummary = async (req, res) => {
    try {
        const userId = req.user._id;

        // 1. Total Revenue & Orders Count (Completed/Processing only for revenue)
        // We aggregate ALL valid orders for revenue
        const revenueAgg = await Order.aggregate([
            { 
                $match: { 
                    user: userId,
                    status: { $in: ['completed', 'processing'] }
                } 
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$total" },
                    totalOrders: { $sum: 1 } // Valid orders count
                }
            }
        ]);

        // 2. Count of ALL orders (including pending/failed for "Total Orders" metric if desired, 
        // usually dashboard shows all legitimate attempts or just successful ones. 
        // Let's count *everything* for "Total Orders" or stick to sales? 
        // Convention: "Total Orders" often implies volume.
        const totalOrdersCount = await Order.countDocuments({ user: userId });

        // 3. Pending Orders (Action Items)
        const pendingCount = await Order.countDocuments({ 
            user: userId, 
            status: { $in: ['processing', 'on-hold', 'pending'] } 
        });

        // 4. Recent Activity Feed
        const recentOrders = await Order.find({ user: userId })
            .sort({ date_created: -1 })
            .limit(5)
            .select('number status total currency date_created billing.first_name billing.last_name');

        const revenue = revenueAgg[0]?.totalRevenue || 0;
        
        res.json({
            revenue: revenue,
            ordersCount: totalOrdersCount,
            pendingCount: pendingCount,
            recentOrders: recentOrders
        });

    } catch (error) {
        console.error('Dashboard Stats Error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
};

/**
 * Get Revenue by Period
 * Returns revenue data grouped by date for the specified period
 */
exports.getRevenueByPeriod = async (req, res) => {
    try {
        const userId = req.user._id;
        const { period = '30days' } = req.query;

        // Calculate date range based on period
        const now = new Date();
        let startDate;
        let groupFormat;

        switch (period) {
            case '7days':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                groupFormat = '%Y-%m-%d';
                break;
            case '30days':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                groupFormat = '%Y-%m-%d';
                break;
            case '3months':
                startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                groupFormat = '%Y-%m-%d';
                break;
            case '6months':
                startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
                groupFormat = '%Y-%m-%d';
                break;
            case '1year':
                startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
                groupFormat = '%Y-%m';
                break;
            default:
                return res.status(400).json({ error: 'Invalid period. Use 7days, 30days, 3months, 6months, or 1year' });
        }

        // MongoDB aggregation pipeline
        const revenueData = await Order.aggregate([
            {
                $match: {
                    user: userId,
                    status: { $in: ['completed', 'processing'] },
                    date_created: { $gte: startDate, $lte: now }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: groupFormat,
                            date: '$date_created'
                        }
                    },
                    revenue: { $sum: '$total' }
                }
            },
            {
                $sort: { _id: 1 }
            },
            {
                $project: {
                    date: '$_id',
                    revenue: 1,
                    _id: 0
                }
            }
        ]);

        // Fill missing dates with 0 revenue
        const filledData = fillMissingDates(revenueData, startDate, now, period);

        res.json({
            period,
            data: filledData
        });

    } catch (error) {
        console.error('Revenue by Period Error:', error);
        res.status(500).json({ error: 'Failed to fetch revenue data' });
    }
};

/**
 * Helper function to fill missing dates with 0 revenue
 */
function fillMissingDates(data, startDate, endDate, period) {
    const result = [];
    const dataMap = new Map(data.map(d => [d.date, d.revenue]));

    if (period === '1year') {
        // Fill months for 1 year period
        const current = new Date(startDate);
        while (current <= endDate) {
            const year = current.getFullYear();
            const month = String(current.getMonth() + 1).padStart(2, '0');
            const dateStr = `${year}-${month}`;
            
            result.push({
                date: dateStr,
                revenue: dataMap.get(dateStr) || 0
            });
            
            current.setMonth(current.getMonth() + 1);
        }
    } else {
        // Fill days for 7days, 30days, 3months, 6months
        const current = new Date(startDate);
        while (current <= endDate) {
            const dateStr = current.toISOString().split('T')[0];
            
            result.push({
                date: dateStr,
                revenue: dataMap.get(dateStr) || 0
            });
            
            current.setDate(current.getDate() + 1);
        }
    }

    return result;
}

/**
 * Legacy Proxy Methods (Optional - can keep if needed for deep drilling, 
 * but for Dashboard we use the above)
 */
// ... (Keeping old methods if you need them, but they are slow)
