import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware.js';
import {
  getDailyOperations,
  toggleRoutineStatus,
  addRoutineItem,
  updateRoutineItem,
  deleteRoutineItem,
  saveDepartmentBriefing,
  updateDepartmentBriefing,
  deleteDepartmentBriefing,
  submitEodClosure,
  updateEodClosure,
  deleteEodClosure,
  resetRoutines,
  getManagerToDos,
  addManagerToDo,
  toggleManagerToDoStatus,
  updateManagerToDo,
  deleteManagerToDo
} from '../controllers/dailyOperations.controller.js';

const router = Router();

// Apply auth middleware
router.use(verifyToken);

router.get('/', getDailyOperations);
router.patch('/routine/:routineId/toggle', toggleRoutineStatus);
router.post('/routine', addRoutineItem);
router.put('/routine/:routineId', updateRoutineItem);
router.delete('/routine/:routineId', deleteRoutineItem);
router.post('/briefing', saveDepartmentBriefing);
router.put('/briefing/:briefingId', updateDepartmentBriefing);
router.delete('/briefing/:briefingId', deleteDepartmentBriefing);
router.post('/eod', submitEodClosure);
router.put('/eod/:eodId', updateEodClosure);
router.delete('/eod/:eodId', deleteEodClosure);
router.post('/reset', resetRoutines);

// Manager To-Do Checklist Routes
router.get('/manager-todo', getManagerToDos);
router.post('/manager-todo', addManagerToDo);
router.patch('/manager-todo/:id/toggle', toggleManagerToDoStatus);
router.put('/manager-todo/:id', updateManagerToDo);
router.delete('/manager-todo/:id', deleteManagerToDo);

export default router;

