const { pool } = require('../db/connectToDb')

const roomHandler = (socket, io) => {
  //Create Room
  socket.on('create-room', async (host_id) => {
    const currentDate = new Date()
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() + 1 // Months are zero-based, so we add 1
    const day = currentDate.getDate()

    const hours = currentDate.getHours()
    const minutes = currentDate.getMinutes()
    const seconds = currentDate.getSeconds()

    const newRoom = await pool.query(
      'INSERT INTO rooms (host_id, created_date, created_time, participants) VALUES ($1, $2, $3, $4) RETURNING room_id;',
      [host_id, `${day}-${month}-${year}`, `${hours}:${minutes}:${seconds}`, '']
    )
    socket.emit('room-created', newRoom?.rows[0].room_id)
  })

  //Join Room
  socket.on('join-room', async (room_id, user_id) => {
    const room = await pool.query('SELECT * FROM rooms WHERE room_id = $1', [
      room_id,
    ])
    if (!room?.rows[0]?.participants?.split(', ').find((j) => j == user_id)) {
      await pool.query(
        `UPDATE rooms SET participants = $1 WHERE room_id = $2`,
        [
          !room.rows[0]?.participants
            ? user_id
            : room.rows[0]?.participants + ', ' + user_id,
          room_id,
        ]
      )
    }

    const roomAfterUpdate = await pool.query(
      'SELECT * FROM rooms WHERE room_id = $1',
      [room_id]
    )

    const participants = await pool.query(
      `SELECT name from users WHERE id IN (${roomAfterUpdate.rows[0]['participants']})`
    )
    socket.emit('room-joined', roomAfterUpdate.rows[0])

    io.emit(
      'get-room-participants',
      participants.rows?.map((j) => j?.name)
    )
  })

  //Leave Room
  socket.on('leave-room', async (room_id, user_id) => {
    const room = await pool.query('SELECT * FROM rooms WHERE room_id = $1', [
      room_id,
    ])

    await pool.query(`UPDATE rooms SET participants = $1 WHERE room_id = $2`, [
      room.rows[0]?.participants
        ?.split(', ')
        .filter((participant) => participant != user_id)
        .join(', '),
      room_id,
    ])

    const roomAfterUpdate = await pool.query(
      'SELECT * FROM rooms WHERE room_id = $1',
      [room_id]
    )

    if (!!roomAfterUpdate.rows[0]['participants']) {
      const participants = await pool.query(
        `SELECT name from users WHERE id IN (${roomAfterUpdate.rows[0]['participants']})`
      )
      io.emit(
        'get-room-participants',
        participants?.rows?.map((j) => j?.name)
      )
    } else {
      io.emit('get-room-participants', [])
    }
  })
}

module.exports = roomHandler
