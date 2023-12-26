import { GenericListener, TypedEventEmitter } from "@ldb/types";
import { logger as baseLogger } from "../loggers";

export class Subsciber<E extends string, ED extends Record<E, GenericListener>, EE extends TypedEventEmitter<ED> = TypedEventEmitter<ED>> {
    private readonly producers: Set<EE> = new Set();

    constructor(protected readonly logger: typeof baseLogger = baseLogger) {}

    get className() {
        return this.constructor.name;
    }

    protected handleError(error: unknown, component: string): void {
        this.logger.logError(`${this.className}.${component}`, error);
    }

    subscribe<Event extends E>(producer: EE, event: Event, listener: ED[Event]): boolean {
        if (this.producers.has(producer)) {
            return false;
        }

        this.producers.add(producer);
        producer.addListener<Event>(event, listener);
        return true;
    }

    unsubscribe<Event extends E>(producer: EE, event: Event, listener: ED[Event]): boolean {
        if (!this.producers.has(producer)) {
            return false;
        }

        producer.removeListener<Event>(event, listener);
        this.producers.delete(producer);
        return true;
    }
}
