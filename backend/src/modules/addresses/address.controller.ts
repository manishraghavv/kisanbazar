import { Response } from 'express';
import { AuthRequest } from '../../common/types/express.d';
import { AddressService } from './address.service';

function handleServiceError(err: unknown, res: Response): void {
  const e = err as { status?: number; statusCode?: number; message?: string };
  res.status(e.statusCode ?? e.status ?? 500).json({ success: false, message: e.message ?? 'Internal server error' });
}

export const createAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const address = await AddressService.create(req.user.id, req.body);
    res.status(201).json({ success: true, message: 'Address created', data: address });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const listAddresses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await AddressService.list(req.user.id, {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    });
    res.json({
      success: true,
      data: result.addresses,
      pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const getAddressById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const address = await AddressService.getById(req.params.id as string, req.user.id);
    res.json({ success: true, data: address });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const updateAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const address = await AddressService.update(req.params.id as string, req.user.id, req.body);
    res.json({ success: true, message: 'Address updated', data: address });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const deleteAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await AddressService.delete(req.params.id as string, req.user.id);
    res.json({ success: true, ...result });
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const setDefaultAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const address = await AddressService.setDefault(req.params.id as string, req.user.id);
    res.json({ success: true, message: 'Default address updated', data: address });
  } catch (err) {
    handleServiceError(err, res);
  }
};
