import { Router } from "express";

const router = Router()

router.get('/users', (req, res) => {
    res.send("USUARIOS")
})

router.get('/users/:userId', (req, res) => {
    const { userId } = req.params;
    res.send("USUARIO")
})

router.post('/users', (req, res) => {
    res.send("CREAR USUARIO")
})

router.delete('/users/:userId', (req, res) => {
    const { userId } = req.params;
    res.send("ELIMINAR USUARIO")
})

router.put('/users/:userId', (req, res) => {
    const { userId } = req.params;
    res.send("ACTUALIZAR USUARIO")
})

export default router;