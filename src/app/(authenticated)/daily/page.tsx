"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase";
import type { DailyLog, DailyTask, Streak, RoadmapGoal } from "@/lib/types";
import {
  format,
  addDays,
  subDays,
  isToday,
  startOfWeek,
  parseISO,
  isSameDay,
} from "date-fns";
import { ko } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Plus,
  X,
  GripVertical,
  Minus,
  Clock,
  Target,
  Flame,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "react-beautiful-dnd";

/* ─── 상수 ─── */
const MOOD_EMOJIS = ["😫", "😔", "😐", "😊", "🤩"];
const MOOD_LABELS = [
  "힘들었어요",
  "아쉬워요",
  "보통이에요",
  "좋았어요",
  "최고였어요!",
];
const HEATMAP_COLORS = [
  "#EBEDF0",
  "#9BE9A8",
  "#40C463",
  "#30A14E",
  "#216E39",
];

function getHeatmapColor(hours: number) {
  if (hours <= 0) return HEATMAP_COLORS[0];
  if (hours <= 2) return HEATMAP_COLORS[1];
  if (hours <= 4) return HEATMAP_COLORS[2];
  if (hours <= 7) return HEATMAP_COLORS[3];
  return HEATMAP_COLORS[4];
}

/* ─── 히트맵 날짜 계산 ─── */
function buildHeatmapGrid() {
  const today = new Date();
  const weeks: Date[][] = [];

  // 이번 주 일요일 기준으로 13주(~3개월)
  const thisWeekStart = startOfWeek(today, { weekStartsOn: 0 });
  const startDate = subDays(thisWeekStart, 12 * 7);

  for (let w = 0; w < 13; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(addDays(startDate, w * 7 + d));
    }
    weeks.push(week);
  }
  return weeks;
}

export default function DailyPage() {
  const supabase = createClient();

  /* ─── 상태 ─── */
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [goals, setGoals] = useState<RoadmapGoal[]>([]);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [heatmapData, setHeatmapData] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [, setShowDatePicker] = useState(false);

  // 입력 상태
  const [goalInput, setGoalInput] = useState("");
  const [goalSaved, setGoalSaved] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [studyHours, setStudyHours] = useState(0);
  const [editingHours, setEditingHours] = useState(false);
  const [hoursInput, setHoursInput] = useState("");
  const [reflection, setReflection] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [weeklyAvg, setWeeklyAvg] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  const datePickerRef = useRef<HTMLInputElement>(null);
  const heatmapWeeks = useRef(buildHeatmapGrid());

  /* ─── 데이터 로드 ─── */
  const fetchDayData = useCallback(
    async (date: Date) => {
      setIsLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);

        const dateStr = format(date, "yyyy-MM-dd");

        const [logRes, goalsRes, streakRes] = await Promise.all([
          supabase
            .from("daily_logs")
            .select("*")
            .eq("user_id", user.id)
            .eq("log_date", dateStr)
            .maybeSingle(),
          supabase
            .from("roadmap_goals")
            .select("id, title")
            .eq("user_id", user.id)
            .eq("status", "in_progress"),
          supabase
            .from("streaks")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        const log = logRes.data as DailyLog | null;
        setDailyLog(log);
        setGoalInput(log?.daily_goal || "");
        setStudyHours(log?.study_hours || 0);
        setReflection(log?.reflection || "");
        setMood(log?.mood ?? null);

        if (log) {
          const { data: taskData } = await supabase
            .from("daily_tasks")
            .select("*")
            .eq("daily_log_id", log.id)
            .order("order_index", { ascending: true });
          setTasks((taskData as DailyTask[]) || []);
        } else {
          setTasks([]);
        }

        setGoals((goalsRes.data as RoadmapGoal[]) || []);
        setStreak((streakRes.data as Streak) || null);

        // 이번 주 평균
        const weekStart = format(subDays(date, 6), "yyyy-MM-dd");
        const { data: weekData } = await supabase
          .from("daily_logs")
          .select("study_hours")
          .eq("user_id", user.id)
          .gte("log_date", weekStart)
          .lte("log_date", dateStr);

        if (weekData && weekData.length > 0) {
          const total = weekData.reduce(
            (s, r) => s + (r.study_hours || 0),
            0
          );
          setWeeklyAvg(Math.round((total / weekData.length) * 10) / 10);
        } else {
          setWeeklyAvg(0);
        }
      } catch (err) {
        console.error(err);
        toast.error("데이터를 불러오지 못했습니다");
      } finally {
        setIsLoading(false);
      }
    },
    [supabase]
  );

  const fetchHeatmap = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const startDate = format(subDays(new Date(), 91), "yyyy-MM-dd");
      const { data } = await supabase
        .from("daily_logs")
        .select("log_date, study_hours")
        .eq("user_id", user.id)
        .gte("log_date", startDate);

      const map: Record<string, number> = {};
      data?.forEach((r) => {
        map[r.log_date] = r.study_hours || 0;
      });
      setHeatmapData(map);
    } catch (err) {
      console.error(err);
    }
  }, [supabase]);

  useEffect(() => {
    fetchDayData(selectedDate);
    fetchHeatmap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchDayData(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  /* ─── UPSERT 헬퍼 ─── */
  const upsertDailyLog = async (fields: Partial<DailyLog>) => {
    if (!userId) return null;
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    const { data, error } = await supabase
      .from("daily_logs")
      .upsert(
        { user_id: userId, log_date: dateStr, ...fields },
        { onConflict: "user_id,log_date" }
      )
      .select()
      .single();

    if (error) {
      toast.error("저장에 실패했습니다");
      throw error;
    }
    setDailyLog(data as DailyLog);

    // 히트맵 업데이트
    setHeatmapData((prev) => ({
      ...prev,
      [dateStr]: (data as DailyLog).study_hours || prev[dateStr] || 0,
    }));

    // 오늘이면 streak 업데이트
    if (isToday(selectedDate)) {
      await updateStreak();
    }

    toast.success("저장되었습니다");
    return data as DailyLog;
  };

  const updateStreak = async () => {
    if (!userId) return;
    const todayStr = format(new Date(), "yyyy-MM-dd");

    if (streak?.last_active_date === todayStr) return; // 이미 오늘 기록

    const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
    let newCurrent = 1;
    let newLongest = streak?.longest_streak || 0;
    const newTotal = (streak?.total_active_days || 0) + 1;

    if (streak?.last_active_date === yesterday) {
      newCurrent = (streak?.current_streak || 0) + 1;
    }
    newLongest = Math.max(newCurrent, newLongest);

    const { data } = await supabase
      .from("streaks")
      .upsert(
        {
          user_id: userId,
          current_streak: newCurrent,
          longest_streak: newLongest,
          last_active_date: todayStr,
          total_active_days: newTotal,
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (data) setStreak(data as Streak);
  };

  /* ─── 날짜 변경 ─── */
  const goToPrevDay = () => setSelectedDate((d) => subDays(d, 1));
  const goToNextDay = () => setSelectedDate((d) => addDays(d, 1));
  const goToToday = () => setSelectedDate(new Date());

  /* ─── 목표 저장 ─── */
  const handleGoalBlur = async () => {
    if (goalInput === (dailyLog?.daily_goal || "")) return;
    try {
      await upsertDailyLog({ daily_goal: goalInput || null });
      setGoalSaved(true);
      setTimeout(() => setGoalSaved(false), 2000);
    } catch {
      /* handled */
    }
  };

  /* ─── 할 일 CRUD ─── */
  const ensureDailyLog = async (): Promise<string> => {
    if (dailyLog) return dailyLog.id;
    const created = await upsertDailyLog({ study_hours: 0 });
    return created!.id;
  };

  const addTask = async () => {
    if (!newTaskTitle.trim()) return;
    try {
      const logId = await ensureDailyLog();
      const { data, error } = await supabase
        .from("daily_tasks")
        .insert({
          daily_log_id: logId,
          title: newTaskTitle.trim(),
          is_completed: false,
          order_index: tasks.length,
        })
        .select()
        .single();

      if (error) throw error;
      setTasks((prev) => [...prev, data as DailyTask]);
      setNewTaskTitle("");
    } catch {
      toast.error("할 일 추가에 실패했습니다");
    }
  };

  const toggleTask = async (task: DailyTask) => {
    const newCompleted = !task.is_completed;
    // 낙관적 업데이트
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              is_completed: newCompleted,
              completed_at: newCompleted ? new Date().toISOString() : null,
            }
          : t
      )
    );

    const { error } = await supabase
      .from("daily_tasks")
      .update({
        is_completed: newCompleted,
        completed_at: newCompleted ? new Date().toISOString() : null,
      })
      .eq("id", task.id);

    if (error) {
      // 롤백
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? task : t))
      );
      toast.error("업데이트에 실패했습니다");
    }
  };

  const deleteTask = async (taskId: string) => {
    const prev = tasks;
    setTasks((t) => t.filter((item) => item.id !== taskId));

    const { error } = await supabase
      .from("daily_tasks")
      .delete()
      .eq("id", taskId);

    if (error) {
      setTasks(prev);
      toast.error("삭제에 실패했습니다");
    }
  };

  const updateTaskGoal = async (taskId: string, goalId: string | null) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, goal_id: goalId } : t))
    );

    await supabase
      .from("daily_tasks")
      .update({ goal_id: goalId })
      .eq("id", taskId);
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(tasks);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);

    const updated = items.map((item, i) => ({ ...item, order_index: i }));
    setTasks(updated);

    // DB 일괄 업데이트
    for (const task of updated) {
      await supabase
        .from("daily_tasks")
        .update({ order_index: task.order_index })
        .eq("id", task.id);
    }
  };

  /* ─── 학습시간 ─── */
  const adjustStudyHours = async (delta: number) => {
    const newVal = Math.max(0, Math.min(24, studyHours + delta));
    setStudyHours(newVal);
    try {
      await upsertDailyLog({ study_hours: newVal });
      setHeatmapData((prev) => ({
        ...prev,
        [format(selectedDate, "yyyy-MM-dd")]: newVal,
      }));
    } catch {
      /* handled */
    }
  };

  const commitHoursInput = async () => {
    const val = Math.max(0, Math.min(24, parseFloat(hoursInput) || 0));
    setStudyHours(val);
    setEditingHours(false);
    try {
      await upsertDailyLog({ study_hours: val });
      setHeatmapData((prev) => ({
        ...prev,
        [format(selectedDate, "yyyy-MM-dd")]: val,
      }));
    } catch {
      /* handled */
    }
  };

  /* ─── 회고 저장 ─── */
  const handleReflectionBlur = async () => {
    if (reflection === (dailyLog?.reflection || "")) return;
    try {
      await upsertDailyLog({ reflection: reflection || null });
    } catch {
      /* handled */
    }
  };

  /* ─── 기분 저장 ─── */
  const handleMoodClick = async (val: number) => {
    setMood(val);
    try {
      await upsertDailyLog({ mood: val });
    } catch {
      /* handled */
    }
  };

  /* ─── 스켈레톤 ─── */
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* 날짜 네비게이션 스켈레톤 */}
        <div className="flex items-center justify-center gap-4 py-4">
          <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
          <div className="w-48 h-8 bg-gray-200 rounded animate-pulse" />
          <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          {/* 목표 */}
          <div className="lg:col-span-3 bg-white rounded-xl shadow-sm p-6">
            <div className="h-5 w-24 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="h-12 bg-gray-200 rounded animate-pulse" />
          </div>
          {/* 할 일 */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
            <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-10 bg-gray-200 rounded animate-pulse"
                />
              ))}
            </div>
          </div>
          {/* 학습시간 */}
          <div className="lg:col-span-1 bg-white rounded-xl shadow-sm p-6">
            <div className="h-5 w-28 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="h-16 bg-gray-200 rounded animate-pulse" />
          </div>
          {/* 회고 */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
            <div className="h-5 w-24 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="h-32 bg-gray-200 rounded animate-pulse" />
          </div>
          {/* 기분 */}
          <div className="lg:col-span-1 bg-white rounded-xl shadow-sm p-6">
            <div className="h-5 w-24 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="flex gap-4 justify-center">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="w-10 h-10 bg-gray-200 rounded-full animate-pulse"
                />
              ))}
            </div>
          </div>
          {/* 히트맵 */}
          <div className="lg:col-span-3 bg-white rounded-xl shadow-sm p-6">
            <div className="h-5 w-24 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="h-28 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const completedTasks = tasks.filter((t) => t.is_completed).length;
  const dateStr = format(selectedDate, "yyyy-MM-dd");

  return (
    <div className="space-y-6">
      {/* ──── 섹션 1: 날짜 네비게이션 ──── */}
      <div className="flex items-center justify-center gap-2 py-2 relative">
        <button
          onClick={goToPrevDay}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>

        <button
          onClick={() => {
            setShowDatePicker(true);
            setTimeout(() => datePickerRef.current?.showPicker(), 50);
          }}
          className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors px-2"
        >
          {format(selectedDate, "yyyy년 M월 d일 EEEE", { locale: ko })}
        </button>
        <input
          ref={datePickerRef}
          type="date"
          value={dateStr}
          onChange={(e) => {
            if (e.target.value) {
              setSelectedDate(parseISO(e.target.value));
              setShowDatePicker(false);
            }
          }}
          className="absolute opacity-0 w-0 h-0 pointer-events-none"
        />

        {isToday(selectedDate) && (
          <span className="bg-blue-100 text-blue-600 rounded-full px-2 py-0.5 text-xs font-medium">
            오늘
          </span>
        )}

        <button
          onClick={goToNextDay}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>

        {!isToday(selectedDate) && (
          <button
            onClick={goToToday}
            className="ml-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            오늘로
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ──── 섹션 2: 오늘의 주요 목표 ──── */}
        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900">오늘의 목표</h2>
            {goalSaved && (
              <Check className="w-4 h-4 text-green-500 animate-pulse" />
            )}
          </div>
          <input
            type="text"
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            onBlur={handleGoalBlur}
            placeholder="오늘 가장 이루고 싶은 것은?"
            className="w-full text-xl text-gray-800 placeholder-gray-300 border-0 border-b-2 border-gray-100 focus:border-blue-400 focus:ring-0 outline-none pb-2 bg-transparent transition-colors"
          />
        </div>

        {/* ──── 섹션 3: 할 일 체크리스트 ──── */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">할 일 목록</h2>
            {tasks.length > 0 && (
              <span className="bg-blue-50 text-blue-600 text-xs font-medium px-2 py-1 rounded-full">
                {completedTasks}/{tasks.length} 완료
              </span>
            )}
          </div>

          {tasks.length === 0 && !newTaskTitle ? (
            <p className="text-gray-400 text-center py-8">
              할 일을 추가하고 하나씩 완료해보세요! ✏️
            </p>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="tasks">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-2 mb-4"
                  >
                    {tasks.map((task, idx) => (
                      <Draggable
                        key={task.id}
                        draggableId={task.id}
                        index={idx}
                      >
                        {(prov, snapshot) => (
                          <div
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            className={`group flex items-center gap-2 p-2 rounded-lg transition-colors ${
                              snapshot.isDragging
                                ? "bg-blue-50 shadow-md"
                                : "hover:bg-gray-50"
                            }`}
                          >
                            <span
                              {...prov.dragHandleProps}
                              className="opacity-0 group-hover:opacity-40 cursor-grab"
                            >
                              <GripVertical className="w-4 h-4 text-gray-400" />
                            </span>
                            <button
                              onClick={() => toggleTask(task)}
                              className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                                task.is_completed
                                  ? "bg-green-500 border-green-500"
                                  : "border-gray-300 hover:border-green-400"
                              }`}
                            >
                              {task.is_completed && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </button>
                            <span
                              className={`flex-1 text-sm ${
                                task.is_completed
                                  ? "line-through text-gray-400"
                                  : "text-gray-800"
                              }`}
                            >
                              {task.title}
                            </span>
                            {/* 로드맵 목표 연결 */}
                            {goals.length > 0 && (
                              <select
                                value={task.goal_id || ""}
                                onChange={(e) =>
                                  updateTaskGoal(
                                    task.id,
                                    e.target.value || null
                                  )
                                }
                                className="text-xs border border-gray-200 rounded px-1 py-0.5 text-gray-500 bg-gray-50 max-w-[120px] truncate"
                              >
                                <option value="">목표 연결</option>
                                {goals.map((g) => (
                                  <option key={g.id} value={g.id}>
                                    {g.title}
                                  </option>
                                ))}
                              </select>
                            )}
                            <button
                              onClick={() => deleteTask(task.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all"
                            >
                              <X className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}

          {/* 새 할 일 추가 */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              placeholder="새 할 일 추가..."
              className="flex-1 text-sm text-gray-700 placeholder-gray-300 border-0 focus:ring-0 outline-none bg-transparent"
            />
            <button
              onClick={addTask}
              disabled={!newTaskTitle.trim()}
              className="p-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-30 disabled:hover:bg-blue-500 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ──── 섹션 4: 학습 시간 ──── */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              오늘 학습 시간
            </h2>
          </div>

          <div className="flex items-center justify-center gap-4 my-6">
            <button
              onClick={() => adjustStudyHours(-0.5)}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            >
              <Minus className="w-5 h-5 text-gray-600" />
            </button>

            {editingHours ? (
              <input
                type="number"
                value={hoursInput}
                onChange={(e) => setHoursInput(e.target.value)}
                onBlur={commitHoursInput}
                onKeyDown={(e) => e.key === "Enter" && commitHoursInput()}
                className="w-20 text-3xl font-bold text-center text-blue-600 border-b-2 border-blue-400 outline-none bg-transparent"
                step="0.5"
                min="0"
                max="24"
                autoFocus
              />
            ) : (
              <button
                onClick={() => {
                  setHoursInput(String(studyHours));
                  setEditingHours(true);
                }}
                className="text-3xl font-bold text-blue-600 hover:text-blue-700 transition-colors"
              >
                {studyHours}
                <span className="text-lg font-normal text-gray-400 ml-1">
                  시간
                </span>
              </button>
            )}

            <button
              onClick={() => adjustStudyHours(0.5)}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            >
              <Plus className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <p className="text-sm text-gray-400 text-center">
            이번 주 평균: {weeklyAvg}시간
          </p>
        </div>

        {/* ──── 섹션 5: 하루 회고 ──── */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            오늘의 회고
          </h2>
          <div className="relative">
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              onBlur={handleReflectionBlur}
              placeholder="오늘 하루를 돌아보며 느낀 점을 자유롭게 적어보세요..."
              className="w-full min-h-[120px] text-sm text-gray-700 placeholder-gray-300 border border-gray-200 rounded-lg p-3 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none resize-y transition-colors"
            />
            <span className="absolute bottom-3 right-3 text-xs text-gray-300">
              {reflection.length}자
            </span>
          </div>
        </div>

        {/* ──── 섹션 6: 오늘의 기분 ──── */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            오늘의 기분
          </h2>
          <div className="flex justify-center gap-3 mb-3">
            {MOOD_EMOJIS.map((emoji, idx) => {
              const val = idx + 1;
              const isSelected = mood === val;
              return (
                <button
                  key={val}
                  onClick={() => handleMoodClick(val)}
                  className={`text-3xl transition-all duration-200 pb-1 ${
                    isSelected
                      ? "scale-125 border-b-2 border-blue-500"
                      : mood !== null
                      ? "opacity-40 hover:opacity-70"
                      : "hover:scale-110"
                  }`}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
          <p className="text-sm text-gray-500 text-center h-5">
            {mood ? MOOD_LABELS[mood - 1] : "기분을 선택하세요"}
          </p>
        </div>

        {/* ──── 섹션 7: 활동 캘린더 히트맵 ──── */}
        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">활동 기록</h2>
            {streak && streak.longest_streak > 0 && (
              <span className="flex items-center gap-1 bg-orange-50 text-orange-600 text-xs font-medium px-2 py-1 rounded-full">
                <Flame className="w-3.5 h-3.5" />
                최장 연속 {streak.longest_streak}일
              </span>
            )}
          </div>

          {/* 히트맵 그리드 */}
          <div className="overflow-x-auto">
            <div className="flex gap-[2px] min-w-fit">
              {/* 요일 라벨 */}
              <div className="flex flex-col gap-[2px] mr-1">
                {["일", "월", "화", "수", "목", "금", "토"].map(
                  (day, idx) => (
                    <div
                      key={day}
                      className="h-3 w-6 text-[10px] text-gray-400 flex items-center"
                    >
                      {idx % 2 === 1 ? day : ""}
                    </div>
                  )
                )}
              </div>
              {/* 주별 컬럼 */}
              {heatmapWeeks.current.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-[2px]">
                  {week.map((day) => {
                    const dStr = format(day, "yyyy-MM-dd");
                    const hours = heatmapData[dStr] || 0;
                    const isFuture = day > new Date();
                    const isSelected = isSameDay(day, selectedDate);

                    return (
                      <button
                        key={dStr}
                        onClick={() => !isFuture && setSelectedDate(day)}
                        title={
                          isFuture
                            ? ""
                            : `${format(day, "M월 d일", { locale: ko })}: ${hours}시간 학습`
                        }
                        disabled={isFuture}
                        className={`w-3 h-3 rounded-sm transition-all ${
                          isSelected ? "ring-2 ring-blue-500 ring-offset-1" : ""
                        } ${isFuture ? "opacity-20" : "hover:ring-1 hover:ring-gray-400"}`}
                        style={{
                          backgroundColor: isFuture
                            ? "#F3F4F6"
                            : getHeatmapColor(hours),
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* 범례 */}
          <div className="flex items-center justify-end gap-1 mt-3 text-xs text-gray-400">
            <span>적음</span>
            {HEATMAP_COLORS.map((color) => (
              <div
                key={color}
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: color }}
              />
            ))}
            <span>많음</span>
          </div>
        </div>
      </div>
    </div>
  );
}
