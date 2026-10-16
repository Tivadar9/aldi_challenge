using { galactic.spacefarer as domain } from '../db/schema';

@requires: 'authenticated-user'
service SpacefarerService {
  entity Spacefarers as projection on domain.Spacefarer;

  @readonly
  entity Planets as projection on domain.Planet;

  @readonly
  entity Departments as projection on domain.Department;

  @readonly
  entity Positions as projection on domain.Position;
}
