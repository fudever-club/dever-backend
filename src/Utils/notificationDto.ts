/**
 * Public shape for notification documents. Strips everything a reader must
 * not receive: internal recipient linkage, embedded credential-bearing
 * metadata (historical records stored full user/project objects), and any
 * other server-internal fields. Read state is injected per reader by the
 * controller — never taken from the shared document flag.
 */
export interface NotificationDto {
    _id: string | null;
    type: string | null;
    title: string | null;
    message: string | null;
    link: string | null;
    isRead: boolean;
    createdAt: unknown;
}

const toPlainObject = (value: any) => (typeof value?.toObject === 'function' ? value.toObject() : value);

export const toNotificationDto = (source: any, isRead: boolean): NotificationDto => {
    const doc = toPlainObject(source) || {};
    const id = doc._id;
    return {
        _id: id?.toString ? id.toString() : id ?? null,
        type: typeof doc.type === 'string' ? doc.type : null,
        title: typeof doc.title === 'string' ? doc.title : null,
        message: typeof doc.message === 'string' ? doc.message : null,
        link: typeof doc.link === 'string' ? doc.link : null,
        isRead: Boolean(isRead),
        createdAt: doc.createdAt ?? null,
    };
};
