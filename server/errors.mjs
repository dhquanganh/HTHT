export class GameError extends Error {
  constructor(message,status=400,code='INVALID_ACTION'){super(message);this.status=status;this.code=code}
}
export function requireCondition(condition,message,status=400,code='INVALID_ACTION'){if(!condition)throw new GameError(message,status,code)}
export function integer(value,min,max,label='Số lượng'){
  requireCondition(Number.isSafeInteger(value)&&value>=min&&value<=max,`${label} không hợp lệ.`);
  return value;
}
