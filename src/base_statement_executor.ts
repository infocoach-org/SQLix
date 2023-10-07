import { ExecutionError } from "./error";
import { StatementExecutor } from "./nparser";

export abstract class BaseStatementExecutor<T> extends StatementExecutor<T> {
  protected relativeTokenError(
    message: string,
    beginRelativeTokenIndex: number,
    endRelativeTokenIndex?: number
  ): never {
    const begin =
      this.finishedTokenSource.tryToGetTokenAtIndex(
        this.start.index + beginRelativeTokenIndex
      ) ?? this.start;
    if (!endRelativeTokenIndex) {
      throw new ExecutionError(message, begin);
    }

    const end =
      this.finishedTokenSource.tryToGetTokenAtIndex(
        this.start.index + endRelativeTokenIndex
      ) ?? this.end;

    throw new ExecutionError(message, begin, end);
  }

  protected generalError(message: string): never {
    throw new ExecutionError(message, this.start, this.end);
  }
}
