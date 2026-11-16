// ─────────────────────────────────────────────────────────────────────────────
//  SMART GUIDE — L1 help text for the MIS pages (web).
//
//  All words the guide shows live in this one file so anyone can change them
//  without touching page code. Keep sentences short and plain.
//  The mobile app has the same idea in erp_mobile/lib/config/guide_content.dart.
//
//  Bump TOUR_VERSION when a tour changes a lot: everybody sees it once more.
// ─────────────────────────────────────────────────────────────────────────────

export const TOUR_VERSION = 1;

export const GUIDE = {
  tasks: {
    title: "Self Task",
    purpose: "Your own to-do list. Work time is measured from Start to Done.",
    tour: [
      { title: "Press Start when you begin", body: "The clock runs only while a task is In Progress. Pause puts it On Hold and stops the clock." },
      { title: "List or Board", body: "Use the toggle on the right. On the Board, drag a card to another column to change its status." },
      { title: "Done locks the task", body: "After Done, only a higher level can reopen it. Check your work first." },
      { title: "Quick add from anywhere", body: "Press Alt+Q, or use the round button at the bottom right, to add a task or tick one off without leaving the page you are on." },
    ],
    help: [
      { title: "Statuses", body: "To Do: not started.\nIn Progress: clock is running.\nOn Hold: paused, clock stopped.\nDone: finished and locked.\nCancelled: dropped." },
      { title: "Tabs", body: "My Tasks: tasks you own.\nAssigned by Me: tasks you gave to others.\nAll Tasks: both together.\nTeam Tasks: your team's tasks (only with the Team permission)." },
      { title: "Cards at the top", body: "Click To Do, In Progress, Overdue or Done This Week to filter the list." },
      { title: "How it counts in your score", body: "On time: finished before the due date and time.\nTime vs estimate: worked time compared with your estimate.\nQuality: every reopen counts as rework.\nTasks with no due date do not count for on-time." },
      { title: "Reopening", body: "A Done task is locked. Open it and click Request reopen with a reason. Your manager, or whoever gave you the task, decides." },
      { title: "Shortcuts", body: "Alt+Q: quick task button.\nEnter on a row: open the task.\nCtrl+Enter in a comment: send it." },
    ],
  },

  followups: {
    title: "Follow-up Board",
    purpose: "Agendas passed from person to person in sprints. Only one person holds an agenda at a time.",
    tour: [
      { title: "\"Waiting on Me\" is your turn", body: "These agendas are waiting on you. Others cannot move until you finish your step." },
      { title: "Start, then hand off or return", body: "Open the agenda and press Start when you pick it up. When your part is done, hand it to the next person or return it to the supervisor." },
      { title: "Supervisors plan on the board", body: "Drag cards between columns, drop a card on a person in the Team rail to assign it, and drag Backlog rows into the sprint." },
    ],
    help: [
      { title: "Tabs", body: "Board: this sprint's agendas by column.\nBacklog: agendas not in a sprint yet.\nWaiting on Me: your active steps and reviews.\nSprint Report: progress, burndown and per-person numbers." },
      { title: "Columns", body: "To Do: nobody has started.\nIn Progress: someone holds it.\nReview: returned to the supervisor.\nDone: closed by the supervisor." },
      { title: "Relay chain", body: "Each step shows who had it, the instruction, their note and whether it was on time." },
      { title: "Sprints", body: "Weekly (Mon–Sun) or Monthly. When a sprint is closed, unfinished agendas move to the backlog or to another open sprint." },
      { title: "How it counts in your score", body: "Pick-up speed: how quickly you press Start after it is handed to you.\nOn time: finishing your step before its target date.\nQuality: a step sent back counts as rework." },
      { title: "Notifications", body: "The next person gets a WhatsApp message on every hand-off, return and send-back." },
    ],
  },

  performance: {
    title: "My Performance",
    purpose: "Your score out of 100, worked out from your own work. Only you, HR and super admin can see it.",
    tour: [
      { title: "Each part has a weight", body: "The bars show how you did on each part. Parts with no data are left out and the rest are re-weighted." },
      { title: "Look at \"Biggest gain\"", body: "It names the weakest part and how to improve it. Fixing that part moves your score the most." },
    ],
    help: [
      { title: "Grades", body: "85 and above: Excellent.\n70–84: Good.\n50–69: Average.\nBelow 50: Needs Improvement." },
      { title: "What is never counted against you", body: "Work that is not due yet is never late. A period with little data is marked, so read it with care." },
      { title: "Week or month", body: "Switch between this week and this month. The trend shows earlier periods." },
    ],
  },

  compliance: {
    title: "Schedule Compliance",
    purpose: "How much work finished on time, per person and per department.",
    tour: [
      { title: "On time, late, missed", body: "Late: finished after the due date. Missed: still open past the due date. Work not due yet is never counted." },
      { title: "Who needs help", body: "The people table puts the most behind first. On track is 90% or more, Watch is 80–89%, Behind is under 80%." },
    ],
    help: [
      { title: "Filters", body: "Pick Monthly or Weekly, step back with the arrows, and narrow by project or department. Click a department row to filter people." },
      { title: "Same rules as the score", body: "These numbers use the same counting as the On-time part of the performance score." },
    ],
  },
};

// ── inline hints (shown at the moment they matter) ──
export const HINTS = {
  noDueDate: "No due date: this task will not count for the on-time score.",
  noEstimate: "Add an estimate to earn the \"Time vs estimate\" points.",
  startFirst: "Press Start when work begins, so your time is measured. Done needs a Start first.",
  cannotStart: "Only the person this task is assigned to can start it.",
  cannotEdit: "Only the person this task is assigned to (or whoever gave it) can change it.",
  emptyTasks: "Nothing here yet. Add a task, for example \"Call supplier at 3pm\", or press Alt+Q from any page.",
  emptyWaiting: "Nothing is waiting on you. When someone hands you an agenda, it shows up here.",
};
