import { Attendance } from '../models/Attendance.model.js';
import { Employee } from '../models/Employee.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { isWithinOffice } from '../services/geo.service.js';
import { config } from '../config/index.js';

// Helper: get start-of-day in local time
const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};



// -------------check in 
export const checkI = asyncHandler(async (req , res) => {
  const {latitude , longitude} = req.body;

  if (latitude == null || longitude == null) {
    throw new ApiError(400 , "location coordinated are required");


  }

  // geo validations

});



// geo check out

export const checkOu = asyncHandler(async (req , res) => {
  const {latitude , longitude} = req.body;
  const employee = req.user;

  if (latitude == null || longitude == null) {
    throw new ApiError(400 , "Location coodianates are required");
  }

  // geo validations

  const geoCheck = isWithinOffice(parseFloat(latitude) , parseFloat(latitude));
  if (!geoCheck.isValid) {
    throw new ApiError(400 , `You are outside office premises (${geoCheck.distance}m away). Must be within 5km.` )
  }


  const today = startOfDay();
  const attendance = await Attendance.findOne({
    employeeCode:employee.employeeCode,date:today
  });

  if (!attendance?.inTime) {
    throw new ApiError(400 , "No check in found for todat .please check in first")
  }
  if (attendance.outTime) {
    throw new ApiError(400 , "Already checked out today")
  }

  const now = new Date();
  const workedMs = now - attendance.inTime;
  const totalMinutes = Math.round(workedMs/60000);
  const totalHours = parseFloat((workedMs/3600000).toFixed(2));

  // shift mon-friday = 8.5 and on sturday 7 hrs

  const dayOfWeek = now.getDay();
  const shiftMinutes = dayOfWeek === 6 ? 420 :510;

  let overtimeMinutes = 0;
  let shortfallMinutes = 0;

  if (totalMinutes >= shiftMinutes) {
    overtimeMinutes = totalMinutes-shiftMinutes
  }else{
    shortfallMinutes = shiftMinutes -totalMinutes;
  }

  attendance.outTime = now;
  attendance.totalHours = totalHours;
  attendance.totalMinutes = totalMinutes;
  attendance.checkOutLatitude = parseFloat(latitude);
  attendance.checkOutLongitude = parseFloat(longitude);
  await attendance.save();

  res.json(200).json(
    new ApiResponse(
      200,{
        attendance,checkedOutAt:now, totalHours, overtimeMinutes , shortfallMinutes
      } , "Checked out succesfully"
    )

  )


})


// ─── CHECK IN ─────────────────────────────────────────────────────────────────
// ─── CHECK OUT ────────────────────────────────────────────────────────────────
export const checkOut = asyncHandler(async (req, res) => {

  res.status(200).json(
    new ApiResponse(
      200,
      {
        attendance,
        checkedOutAt: now,
        totalHours,
        totalMinutes,
        overtimeMinutes,
        shortfallMinutes,
      },
      'Checked out successfully'
    )
  );
});

// ─── TODAY'S STATUS ───────────────────────────────────────────────────────────
export const getTodayStatus = asyncHandler(async (req, res) => {
  const today = startOfDay();
  const record = await Attendance.findOne({
    employeeCode: req.user.employeeCode,
    date: today,
  });

  const office = {
    lat: config.office.latitude,
    lng: config.office.longitude,
    radius: config.office.radiusMeters,
  };

  res.json(new ApiResponse(200, { record, date: today, office }, 'Today status fetched'));
});

// ─── MY ATTENDANCE SUMMARY ────────────────────────────────────────────────────
export const getMySummary = asyncHandler(async (req, res) => {
  const employee = req.user;
  const { from, to } = req.query;

  const start = from ? startOfDay(new Date(from)) : startOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const end = to ? endOfDay(new Date(to)) : endOfDay(new Date());

  const records = await Attendance.find({
    employeeCode: employee.employeeCode,
    date: { $gte: start, $lte: end },
  }).sort({ date: -1 });

  // ── Build daily summary ──
  const summary = {
    present: 0,
    absent: 0,
    weekOff: 0,
    late: 0,
    totalHours: 0,
  };

  const dailyList = [];
  let current = new Date(start);

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const record = records.find((r) => r.date.toISOString().split('T')[0] === dateStr);
    const dow = current.getDay();

    if (dow === 0) {
      // Sunday = Week Off
      dailyList.push({ date: new Date(current), status: 'WO', isWeekOff: true });
      summary.weekOff++;
    } else if (record) {
      if (record.isLate) summary.late++;
      if (record.inTime) summary.present++;
      summary.totalHours += record.totalHours || 0;
      dailyList.push(record);
    } else {
      // No record = Absent
      dailyList.push({ date: new Date(current), status: 'A', isAbsent: true });
      summary.absent++;
    }

    current.setDate(current.getDate() + 1);
  }

  res.json(
    new ApiResponse(200, { summary, records: dailyList }, 'Attendance summary fetched')
  );
});

// ─── ADMIN: ALL ATTENDANCE LIST ───────────────────────────────────────────────
export const getAdminAttendanceList = asyncHandler(async (req, res) => {
  const { from, to, search, statusFilter, page = 1, limit = 50 } = req.query;

  const today = startOfDay();
  const start = from ? startOfDay(new Date(from)) : today;
  const end = to ? endOfDay(new Date(to)) : endOfDay(new Date());

  const query = { date: { $gte: start, $lte: end } };

  if (search) {
    const employees = await Employee.find({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { employeeCode: { $regex: search, $options: 'i' } },
      ],
    }).select('employeeCode');
    query.employeeCode = { $in: employees.map((e) => e.employeeCode) };
  }

  if (statusFilter && statusFilter !== 'All') {
    if (statusFilter === 'Completed') {
      query.outTime = { $ne: null };
    } else if (statusFilter === 'NotCheckedOut') {
      query.inTime = { $ne: null };
      query.outTime = null;
    } else {
      query.status = statusFilter;
    }
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [records, total] = await Promise.all([
    Attendance.find(query).sort({ date: -1 }).skip(skip).limit(Number(limit)),
    Attendance.countDocuments(query),
  ]);

  res.json(
    new ApiResponse(
      200,
      { records, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) },
      'Attendance list fetched'
    )
  );
});
