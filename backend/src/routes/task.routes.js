import { Router } from 'express';
import protectRoute from '../middleware/auth.middleware.js';
import { taskController } from '../controllers/task.controller.js';

const router = Router();

// Protect all task endpoints
router.use(protectRoute);

router.get('/all', taskController.getAllTasks);
router.get('/', taskController.getAllTasks);
router.post('/create', taskController.createTask);
router.post('/', taskController.createTask);
router.patch('/:id', taskController.updateTask);
router.put('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

export default router;
