import { getIO, initSocket } from "../../lib/socket";

const handler = (req: any, res: any) => {
  if (res.socket.server.io) {
    res.end();
    return;
  }

  const httpServer = res.socket.server;
  initSocket(httpServer);
  res.socket.server.io = getIO();

  console.log("Socket.IO server started");
  res.end();
};

export default handler;
export const config = { api: { bodyParser: false } };
