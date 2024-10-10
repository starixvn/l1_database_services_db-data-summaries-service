import type { BaseLogger } from "@ldb/base-logger";
import { EventsDescription, GenericListener, TypedEventEmitter } from "@ldb/types";

export class Dispatcher<
    EventDescs extends EventsDescription,
    PubEvent extends string,
    PubEventDesc extends Record<PubEvent, GenericListener>,
    Publisher extends TypedEventEmitter<PubEventDesc> = TypedEventEmitter<PubEventDesc>,
> extends TypedEventEmitter<EventDescs> {
    private readonly publishers: Set<Publisher> = new Set();

    constructor(protected readonly logger: BaseLogger) {
        super();
    }

    get className() {
        return this.constructor.name;
    }

    protected handleError(error: unknown, component: string) {
        this.logger.logError({ title: `${this.className}.${component}`, message: error });
    }

    subscribe<Event extends PubEvent>(publisher: Publisher, event: Event, listener: PubEventDesc[Event]): boolean {
        if (this.publishers.has(publisher)) {
            return false;
        }

        this.publishers.add(publisher);
        publisher.addListener<Event>(event, listener);
        return true;
    }

    unsubscribe<Event extends PubEvent>(publisher: Publisher, event: Event, listener: PubEventDesc[Event]): boolean {
        if (!this.publishers.has(publisher)) {
            return false;
        }

        publisher.removeListener<Event>(event, listener);
        this.publishers.delete(publisher);
        return true;
    }
}
